import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/meals-data";

export type ProgressLog = {
  id: string;
  weight: number | null;
  body_fat: number | null;
  muscle_mass: number | null;
  notes: string | null;
  logged_at: string;
};

export type WorkoutCompletionRow = {
  workout_day_id: string;
  completed_on: string;
  completion_percentage: number;
  duration_minutes: number | null;
  estimated_calories: number | null;
  workout_title: string | null;
};

export type ProgressData = {
  logs: ProgressLog[];
  /** Whole-workout completions only (exercise_id IS NULL), enriched from workout_days. */
  workouts: WorkoutCompletionRow[];
  mealsCompletedThisWeek: number;
  mealsPlannedPerWeek: number;
  hasActivePlan: boolean;
};

/** Local (not UTC) start of the current week, Sunday-based, as a YYYY-MM-DD key. */
export function startOfWeekKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay());
  return localDateKey(d);
}

function addDaysKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d!);
  dt.setDate(dt.getDate() + days);
  return localDateKey(dt);
}

export async function fetchProgressData(now = new Date()): Promise<ProgressData | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const uid = u.user.id;

  const weekStart = startOfWeekKey(now);
  const weekEnd = addDaysKey(weekStart, 6);

  const [logsRes, compRes, planRes] = await Promise.all([
    supabase
      .from("progress_logs")
      .select("id, weight, body_fat, muscle_mass, notes, logged_at")
      .eq("user_id", uid)
      .order("logged_at", { ascending: true }),
    supabase
      .from("workout_completions")
      .select(
        "workout_day_id, completed_on, completion_percentage, workout_days ( duration_minutes, estimated_calories, workout_title )",
      )
      .eq("user_id", uid)
      .is("exercise_id", null)
      .order("completed_on", { ascending: true }),
    supabase
      .from("ai_plans")
      .select("id, meal_days ( id, meal_items ( id ) )")
      .eq("user_id", uid)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (logsRes.error) throw logsRes.error;
  if (compRes.error) throw compRes.error;
  if (planRes.error) throw planRes.error;

  // Guard against any duplicate whole-workout rows for the same day+workout.
  const seen = new Set<string>();
  const workouts: WorkoutCompletionRow[] = [];
  for (const c of (compRes.data ?? []) as any[]) {
    const key = `${c.completed_on}|${c.workout_day_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    workouts.push({
      workout_day_id: c.workout_day_id,
      completed_on: c.completed_on,
      completion_percentage: c.completion_percentage,
      duration_minutes: c.workout_days?.duration_minutes ?? null,
      estimated_calories: c.workout_days?.estimated_calories ?? null,
      workout_title: c.workout_days?.workout_title ?? null,
    });
  }

  const mealItemIds =
    ((planRes.data as any)?.meal_days ?? []).flatMap((d: any) =>
      (d.meal_items ?? []).map((m: any) => m.id as string),
    ) ?? [];

  let mealsCompletedThisWeek = 0;
  if (mealItemIds.length) {
    const { count, error } = await supabase
      .from("meal_completions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("completed_on", weekStart)
      .lte("completed_on", weekEnd)
      .in("meal_item_id", mealItemIds);
    if (error) throw error;
    mealsCompletedThisWeek = count ?? 0;
  }

  return {
    logs: (logsRes.data ?? []) as ProgressLog[],
    workouts,
    mealsCompletedThisWeek,
    mealsPlannedPerWeek: mealItemIds.length,
    hasActivePlan: Boolean(planRes.data),
  };
}

export async function addProgressLog(input: {
  weight: number;
  body_fat?: number | null;
  muscle_mass?: number | null;
  notes?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await supabase.from("progress_logs").insert({
    user_id: u.user.id,
    weight: input.weight,
    body_fat: input.body_fat ?? null,
    muscle_mass: input.muscle_mass ?? null,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

/* ---------- derived statistics ---------- */

export function weightStats(logs: ProgressLog[]) {
  const withWeight = logs.filter((l) => l.weight != null);
  if (!withWeight.length) return null;
  const first = Number(withWeight[0]!.weight);
  const latest = Number(withWeight[withWeight.length - 1]!.weight);
  const change = latest - first;
  const percent = first ? (change / first) * 100 : 0;
  return { first, latest, change, percent, entries: withWeight.length };
}

/** Distinct calendar days with at least one completed workout. */
function completedDayKeys(workouts: WorkoutCompletionRow[]) {
  return Array.from(new Set(workouts.map((w) => w.completed_on))).sort();
}

/** Consecutive local calendar days ending today (or yesterday, so today stays "alive"). */
export function currentStreak(workouts: WorkoutCompletionRow[], now = new Date()) {
  const days = new Set(completedDayKeys(workouts));
  if (!days.size) return 0;
  const today = localDateKey(now);
  const yesterday = addDaysKey(today, -1);
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

export function longestStreak(workouts: WorkoutCompletionRow[]) {
  const days = completedDayKeys(workouts);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDaysKey(prev, 1) === d ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }
  return best;
}

export function avgWorkoutsPerWeek(workouts: WorkoutCompletionRow[], now = new Date()) {
  if (!workouts.length) return 0;
  const firstKey = workouts[0]!.completed_on;
  const [y, m, d] = firstKey.split("-").map(Number);
  const first = new Date(y!, (m ?? 1) - 1, d!);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(1, Math.round((today.getTime() - first.getTime()) / 86_400_000) + 1);
  const weeks = Math.max(1, days / 7);
  return workouts.length / weeks;
}

export function totalWorkoutHours(workouts: WorkoutCompletionRow[]) {
  const mins = workouts.reduce((s, w) => s + (w.duration_minutes ?? 0), 0);
  return mins / 60;
}

/** Last 7 local days (oldest first) with per-day workout count, minutes and calories. */
export function weeklySeries(workouts: WorkoutCompletionRow[], now = new Date()) {
  const todayKey = localDateKey(now);
  const out: { key: string; label: string; workouts: number; minutes: number; calories: number }[] =
    [];
  for (let i = 6; i >= 0; i--) {
    const key = addDaysKey(todayKey, -i);
    const rows = workouts.filter((w) => w.completed_on === key);
    const [yy, mm, dd] = key.split("-").map(Number);
    out.push({
      key,
      label: new Date(yy!, (mm ?? 1) - 1, dd!).toLocaleDateString(undefined, { weekday: "short" }),
      workouts: rows.length,
      minutes: rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0),
      calories: rows.reduce((s, r) => s + (r.estimated_calories ?? 0), 0),
    });
  }
  return out;
}

export type Achievement = { id: string; title: string; description: string };

export function earnedAchievements(data: ProgressData, now = new Date()): Achievement[] {
  const out: Achievement[] = [];
  const streak = Math.max(currentStreak(data.workouts, now), longestStreak(data.workouts));
  const total = data.workouts.length;
  const adherence = data.mealsPlannedPerWeek
    ? (data.mealsCompletedThisWeek / data.mealsPlannedPerWeek) * 100
    : 0;

  if (streak >= 3)
    out.push({ id: "streak3", title: "3-day streak", description: "Trained 3 days in a row" });
  if (streak >= 7)
    out.push({ id: "streak7", title: "7-day streak", description: "A full week of training" });
  if (total >= 1)
    out.push({ id: "first-workout", title: "First workout", description: "You got started" });
  if (total >= 10)
    out.push({ id: "workouts10", title: "10 workouts", description: "10 sessions completed" });
  if (data.logs.length >= 1)
    out.push({ id: "first-log", title: "First progress entry", description: "You logged your body metrics" });
  if (adherence >= 50)
    out.push({ id: "nutrition50", title: "50% nutrition adherence", description: "Half your planned meals this week" });
  if (adherence >= 80)
    out.push({ id: "nutrition80", title: "80% nutrition adherence", description: "Excellent nutrition consistency" });
  return out;
}
