import { supabase } from "@/integrations/supabase/client";
import { DAY_NAMES, normalizeDay } from "@/lib/day-utils";

export type MealItem = {
  id: string;
  meal_order: number;
  meal_name: string;
  meal_type: string | null;
  scheduled_time: string | null;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fats: number | null;
  ingredients: string[];
  notes: string | null;
};

export type TodayMeals = {
  planId: string;
  dayName: string;
  targetCalories: number;
  targetProtein: number;
  meals: MealItem[];
  completedIds: string[];
} | null;

const DAYS = DAY_NAMES;

export function localDateKey(now = new Date()) {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** One optimized read: active plan -> today's meal day -> items, plus today's completions. */
export async function fetchTodayMeals(now = new Date()): Promise<TodayMeals> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const { data, error } = await supabase
    .from("ai_plans")
    .select(
      `id,
       meal_days ( id, day_name, total_calories, protein,
         meal_items ( id, meal_order, meal_name, meal_type, scheduled_time, calories, protein, carbohydrates, fats, ingredients, notes ) )`,
    )
    .eq("user_id", u.user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const today = normalizeDay(DAYS[now.getDay()]);
  const days = (data.meal_days ?? []).filter((d: any) => normalizeDay(d.day_name) === today);
  const meals = days
    .flatMap((d: any) => (d.meal_items ?? []) as MealItem[])
    .sort(
      (a, b) =>
        (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "") ||
        a.meal_order - b.meal_order,
    );

  const sumCal = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const sumPro = meals.reduce((s, m) => s + Number(m.protein ?? 0), 0);

  let completedIds: string[] = [];
  if (meals.length) {
    const { data: comps, error: cErr } = await supabase
      .from("meal_completions")
      .select("meal_item_id")
      .eq("user_id", u.user.id)
      .eq("completed_on", localDateKey(now))
      .in("meal_item_id", meals.map((m) => m.id));
    if (cErr) throw cErr;
    completedIds = (comps ?? []).map((c) => c.meal_item_id);
  }

  return {
    planId: data.id,
    dayName: DAYS[now.getDay()]!,
    targetCalories: Math.round(
      days.reduce((s: number, d: any) => s + (d.total_calories ?? 0), 0) || sumCal,
    ),
    targetProtein: Math.round(
      days.reduce((s: number, d: any) => s + Number(d.protein ?? 0), 0) || sumPro,
    ),
    meals,
    completedIds,
  };
}

export async function setMealCompleted(mealItemId: string, completed: boolean, now = new Date()) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const completed_on = localDateKey(now);

  if (completed) {
    const { error } = await supabase
      .from("meal_completions")
      .upsert(
        { user_id: u.user.id, meal_item_id: mealItemId, completed_on },
        { onConflict: "user_id,meal_item_id,completed_on" },
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("meal_completions")
      .delete()
      .eq("user_id", u.user.id)
      .eq("meal_item_id", mealItemId)
      .eq("completed_on", completed_on);
    if (error) throw error;
  }
}
