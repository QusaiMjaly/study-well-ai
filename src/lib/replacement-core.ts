// הקובץ הזה מכיל עזרים משותפים להחלפת ארוחה או תרגיל — טעינת פריטים, יעדים, סכומים ועדכון תמונות.
/**
 * Shared, transport-agnostic helpers for single-item replacement.
 *
 * Every function receives the caller's authenticated Supabase client, so RLS
 * (owns_meal_day / owns_workout_day) is always the ownership boundary. No
 * service-role access is used anywhere in the replacement feature.
 */
import { STALE_MESSAGE } from "./replacement-schema";
import type { UserContext } from "./replacement-prompt";
import type { BalancedMeal } from "./replacement-schema";

/** Loosely typed client: the generated Database types are applied by callers. */
type Db = any;

// הפונקציה טוענת את פרטי הפרופיל והיעדים של המשתמש כהקשר עבור החלפת ארוחה או תרגיל
export async function loadUserContext(supabase: Db, userId: string): Promise<UserContext> {
  const [{ data: profile }, { data: goals }] = await Promise.all([
    supabase
      .from("profiles")
      .select("age, gender, height, weight, activity_level")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("goals")
      .select(
        "goal_type, target_weight, workout_preference, meal_preference, workout_duration, biggest_challenge",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    age: profile?.age ?? null,
    gender: profile?.gender ?? null,
    height: profile?.height ?? null,
    weight: profile?.weight ?? null,
    activity_level: profile?.activity_level ?? null,
    goal_type: goals?.goal_type ?? null,
    target_weight: goals?.target_weight ?? null,
    workout_preference: goals?.workout_preference ?? null,
    meal_preference: goals?.meal_preference ?? null,
    workout_duration: goals?.workout_duration ?? null,
    biggest_challenge: goals?.biggest_challenge ?? null,
  };
}

// הפונקציה זורקת שגיאת "התוכנית כבר לא עדכנית" כשהפריט שהמשתמש מנסה להחליף לא קיים או לא שלו
export function staleError(): never {
  throw new Error(STALE_MESSAGE);
}

/* ------------------------------------------------------------------ meals */

export type LoadedMeal = {
  meal: any;
  day: any;
  dayMeals: any[];
  planId: string;
};

/**
 * Loads a meal with its day, sibling meals and owning plan.
 * Ownership comes from RLS; plan activity and identity are re-derived here.
 */
// הפונקציה טוענת ארוחה יחד עם היום שלה, שאר הארוחות והתוכנית, ומוודאת שהכל עדיין פעיל ושייך למשתמש
export async function loadMeal(
  supabase: Db,
  mealItemId: string,
  planId: string,
): Promise<LoadedMeal> {
  const { data: meal, error } = await supabase
    .from("meal_items")
    .select("*")
    .eq("id", mealItemId)
    .maybeSingle();
  if (error || !meal) staleError();

  const { data: day } = await supabase
    .from("meal_days")
    .select(
      "id, plan_id, day_name, total_calories, protein, carbohydrates, fats, meal_items ( id, meal_order, meal_name, meal_type, scheduled_time, calories, protein, carbohydrates, fats, ingredients, preparation_steps, image_prompt, image_path, image_status, notes )",
    )
    .eq("id", meal.meal_day_id)
    .maybeSingle();
  if (!day) staleError();

  const { data: plan } = await supabase
    .from("ai_plans")
    .select("id, is_active")
    .eq("id", day.plan_id)
    .maybeSingle();
  if (!plan || !plan.is_active || plan.id !== planId) staleError();

  const dayMeals = ((day.meal_items ?? []) as any[])
    .slice()
    .sort((a, b) => a.meal_order - b.meal_order);

  return { meal, day, dayMeals, planId: plan.id };
}

/**
 * Intended daily targets for a meal day.
 *
 * meal_days.total_calories / protein are the plan's generated TARGETS and are
 * never overwritten by replacements, so they are authoritative. Only when a day
 * has no stored target do we fall back to the plan's other days.
 */
// הפונקציה מחזירה את יעדי הקלוריות והחלבון היומיים של התוכנית (היעד המקורי, לא הסכום בפועל)
export async function dayTargets(
  supabase: Db,
  planId: string,
  mealDayId: string,
  stored: { calories: number; protein: number },
): Promise<{ calories: number; protein: number }> {
  if (stored.calories > 0) return stored;

  const { data } = await supabase
    .from("meal_days")
    .select("id, total_calories, protein")
    .eq("plan_id", planId);

  const others = ((data ?? []) as any[]).filter(
    (d) => d.id !== mealDayId && (d.total_calories ?? 0) > 0,
  );
  if (!others.length) return stored;

  const avg = (nums: number[]) => Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
  return {
    calories: avg(others.map((d) => Number(d.total_calories ?? 0))),
    protein: avg(others.map((d) => Number(d.protein ?? 0))),
  };
}

export type DayTotals = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fats: number;
};

// הפונקציה מסכמת קלוריות ומאקרו של רשימת ארוחות
export function sumMeals(meals: any[]): DayTotals {
  return {
    calories: Math.round(meals.reduce((s, m) => s + Number(m.calories ?? 0), 0)),
    protein: Math.round(meals.reduce((s, m) => s + Number(m.protein ?? 0), 0)),
    carbohydrates: Math.round(meals.reduce((s, m) => s + Number(m.carbohydrates ?? 0), 0)),
    fats: Math.round(meals.reduce((s, m) => s + Number(m.fats ?? 0), 0)),
  };
}

/**
 * ACTUAL totals for a day, summed from the persisted meal items.
 *
 * These are intentionally NOT written back into meal_days: those columns hold
 * the plan's intended targets, and overwriting them would make every deviation
 * comparison compare a value against itself.
 */
// הפונקציה מחשבת את סך הקלוריות בפועל של היום לפי הארוחות השמורות (בלי לדרוס את היעדים)
export async function recomputeDayTotals(supabase: Db, mealDayId: string): Promise<DayTotals> {
  const { data } = await supabase
    .from("meal_items")
    .select("calories, protein, carbohydrates, fats")
    .eq("meal_day_id", mealDayId);

  return sumMeals((data ?? []) as any[]);
}

/** Balance-my-day trigger: >=100 kcal, or >=5% of target kcal, or >=15 g protein. */
// הפונקציה בודקת אם היום סטה מספיק מהיעד כדי להציע את פעולת "איזון היום"
export function shouldOfferBalance(
  totals: DayTotals,
  targets: { calories: number; protein: number },
): boolean {
  const kcalDiff = Math.abs(totals.calories - targets.calories);
  const proteinDiff = Math.abs(totals.protein - targets.protein);
  return (
    kcalDiff >= 100 ||
    (targets.calories > 0 && kcalDiff >= targets.calories * 0.05) ||
    proteinDiff >= 15
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * A meal keeps its existing photo only when the represented dish is unchanged:
 * same name, same image prompt AND the same ingredient set.
 */
// הפונקציה בודקת אם המנה נשארה זהה, כדי לדעת אם אפשר לשמור את התמונה הקיימת שלה
export function imageStillValid(
  before: { meal_name: string; image_prompt: string | null; ingredients: string[] | null },
  after: { meal_name: string; image_prompt: string | null; ingredients: string[] },
): boolean {
  if (norm(before.meal_name) !== norm(after.meal_name)) return false;
  if (norm(before.image_prompt ?? "") !== norm(after.image_prompt ?? "")) return false;
  const a = (before.ingredients ?? []).map(norm).sort().join("|");
  const b = after.ingredients.map(norm).sort().join("|");
  return a === b;
}

// הפונקציה בונה את עדכון הארוחה במסד, ומאפסת את התמונה אם המנה השתנתה
export function balancedMealUpdate(existing: any, next: BalancedMeal) {
  const keepImage = imageStillValid(existing, next);
  return {
    meal_name: next.meal_name,
    calories: next.calories,
    protein: next.protein,
    carbohydrates: next.carbohydrates,
    fats: next.fats,
    ingredients: next.ingredients,
    preparation_steps: next.preparation_steps,
    image_prompt: next.image_prompt,
    notes: next.notes,
    ...(keepImage ? {} : { image_path: null, image_status: "none" }),
  };
}

/* -------------------------------------------------------------- exercises */

export type LoadedExercise = {
  exercise: any;
  day: any;
  dayExercises: any[];
  planId: string;
};

// הפונקציה טוענת תרגיל יחד עם יום האימון שלו ומוודאת שהוא עדיין פעיל ושייך למשתמש
export async function loadExercise(
  supabase: Db,
  exerciseId: string,
  planId: string,
): Promise<LoadedExercise> {
  const { data: exercise, error } = await supabase
    .from("workout_exercises")
    .select("*")
    .eq("id", exerciseId)
    .maybeSingle();
  if (error || !exercise) staleError();

  const { data: day } = await supabase
    .from("workout_days")
    .select(
      "id, plan_id, day_name, workout_title, workout_type, duration_minutes, workout_exercises ( id, exercise_order, exercise_name, exercise_slug )",
    )
    .eq("id", exercise.workout_day_id)
    .maybeSingle();
  if (!day) staleError();

  const { data: plan } = await supabase
    .from("ai_plans")
    .select("id, is_active")
    .eq("id", day.plan_id)
    .maybeSingle();
  if (!plan || !plan.is_active || plan.id !== planId) staleError();

  const dayExercises = ((day.workout_exercises ?? []) as any[])
    .slice()
    .sort((a, b) => a.exercise_order - b.exercise_order);

  return { exercise, day, dayExercises, planId: plan.id };
}
