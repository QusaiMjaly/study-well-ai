import { supabase } from "@/integrations/supabase/client";
import { DAY_NAMES, normalizeDay, weekOrderFrom } from "@/lib/day-utils";

export { normalizeDay };

export type ActivePlan = {
  id: string;
  plan_name: string;
  workout_days: {
    id: string;
    day_name: string;
    workout_title: string | null;
    workout_type: string | null;
    duration_minutes: number | null;
    estimated_calories: number | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
  }[];
  meal_days: {
    id: string;
    day_name: string;
    total_calories: number | null;
    protein: number | null;
    meal_items: {
      id: string;
      meal_name: string;
      meal_type: string | null;
      scheduled_time: string | null;
      calories: number | null;
      protein: number | null;
      meal_order: number;
    }[];
  }[];
  ai_daily_tips: { id: string; day_name: string; tip_text: string }[];
};

/** Single optimized read of the user's active plan with all nested children. */
// הפונקציה טוענת את התוכנית הפעילה של המשתמש עם כל האימונים, הארוחות והטיפים בקריאה אחת
export async function fetchActivePlan(): Promise<ActivePlan | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const { data, error } = await supabase
    .from("ai_plans")
    .select(
      `id, plan_name,
       workout_days ( id, day_name, workout_title, workout_type, duration_minutes, estimated_calories, scheduled_start, scheduled_end ),
       meal_days ( id, day_name, total_calories, protein,
         meal_items ( id, meal_name, meal_type, scheduled_time, calories, protein, meal_order ) ),
       ai_daily_tips ( id, day_name, tip_text )`,
    )
    .eq("user_id", u.user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ActivePlan) ?? null;
}

const DAYS = DAY_NAMES;

// הפונקציה ממירה מחרוזת שעה "HH:mm" למספר דקות מאז חצות
function minutesOf(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hh = Number(h);
  const mm = Number(m ?? 0);
  if (Number.isNaN(hh)) return null;
  return hh * 60 + mm;
}

// הפונקציה מעצבת שעה לתצוגה ידידותית בשפה המקומית של המכשיר
export function formatTime(time: string | null | undefined) {
  const mins = minutesOf(time);
  if (mins === null) return "—";
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Days ordered starting from today, so "nearest upcoming" wraps across the week. */
// הפונקציה מחזירה את ימות השבוע בסדר שמתחיל מהיום, עם גלילה לשבוע הבא
function upcomingDayOrder(now: Date) {
  return weekOrderFrom(now).map((i) => DAYS[i]!);
}

// הפונקציה מוצאת את האימון הקרוב הבא בתוכנית, החל מהיום ואילך
export function pickNextWorkout(plan: ActivePlan | null, now = new Date()) {
  if (!plan) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const order = upcomingDayOrder(now);
  for (let i = 0; i < order.length; i++) {
    const target = normalizeDay(order[i]);
    const candidates = plan.workout_days
      .filter((w) => normalizeDay(w.day_name) === target)
      .filter((w) => (i === 0 ? (minutesOf(w.scheduled_start) ?? 0) >= nowMins : true))
      .sort((a, b) => (minutesOf(a.scheduled_start) ?? 0) - (minutesOf(b.scheduled_start) ?? 0));
    if (candidates.length) return candidates[0]!;
  }
  return null;
}

// הפונקציה מוצאת את הארוחה הקרובה הבאה בתוכנית, החל מהיום ואילך
export function pickNextMeal(plan: ActivePlan | null, now = new Date()) {
  if (!plan) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const order = upcomingDayOrder(now);
  for (let i = 0; i < order.length; i++) {
    const target = normalizeDay(order[i]);
    const items = plan.meal_days
      .filter((d) => normalizeDay(d.day_name) === target)
      .flatMap((d) => d.meal_items)
      .filter((m) => (i === 0 ? (minutesOf(m.scheduled_time) ?? 0) >= nowMins : true))
      .sort(
        (a, b) =>
          (minutesOf(a.scheduled_time) ?? a.meal_order * 60) -
          (minutesOf(b.scheduled_time) ?? b.meal_order * 60),
      );
    if (items.length) return items[0]!;
  }
  return null;
}

// הפונקציה מסכמת את נתוני היום הנוכחי: כמה אימונים, כמה ארוחות וכמה קלוריות/חלבון
export function todaySummary(plan: ActivePlan | null, now = new Date()) {
  const today = normalizeDay(DAYS[now.getDay()]);
  const workouts = plan?.workout_days.filter((w) => normalizeDay(w.day_name) === today) ?? [];
  const days = plan?.meal_days.filter((d) => normalizeDay(d.day_name) === today) ?? [];
  const meals = days.flatMap((d) => d.meal_items);
  const calories =
    days.reduce((s, d) => s + (d.total_calories ?? 0), 0) ||
    meals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const protein =
    days.reduce((s, d) => s + Number(d.protein ?? 0), 0) ||
    meals.reduce((s, m) => s + Number(m.protein ?? 0), 0);
  return {
    workoutCount: workouts.length,
    mealCount: meals.length,
    calories: Math.round(calories),
    protein: Math.round(protein),
  };
}

// הפונקציה מחזירה את הטיפ היומי של ה-AI שמתאים להיום
export function todayTip(plan: ActivePlan | null, now = new Date()) {
  if (!plan) return null;
  const today = normalizeDay(DAYS[now.getDay()]);
  return (
    plan.ai_daily_tips.find((t) => normalizeDay(t.day_name) === today) ??
    plan.ai_daily_tips[0] ??
    null
  );
}
