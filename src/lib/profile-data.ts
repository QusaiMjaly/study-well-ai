import { supabase } from "@/integrations/supabase/client";
import type { ScheduleJson } from "@/lib/schedule-schema";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  activity_level: string | null;
  created_at: string | null;
};

export type GoalsRow = {
  id: string;
  goal_type: string | null;
  target_weight: number | null;
  workout_days: number | null;
  workout_preference: string | null;
  meal_preference: string | null;
  workout_duration: string | null;
  preferred_time: string | null;
  biggest_challenge: string | null;
  created_at: string | null;
};

export type ScheduleRow = {
  id: string;
  image_url: string | null;
  schedule_json: ScheduleJson | null;
  created_at: string | null;
};

export type ProfileBundle = {
  userId: string;
  authEmail: string | null;
  profile: ProfileRow | null;
  goals: GoalsRow | null;
  schedule: ScheduleRow | null;
  activePlan: { id: string; plan_name: string; created_at: string } | null;
  /** Weekday names (as stored) that have a workout in the active plan. */
  workoutDayNames: string[];
};

/** One authenticated read of everything the Profile page needs. */
export async function fetchProfileBundle(): Promise<ProfileBundle> {
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;
  const user = u.user;
  if (!user) throw new Error("Not signed in");

  const [p, g, s, plan] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("schedules")
      .select("id, image_url, schedule_json, created_at")
      .eq("user_id", user.id)
      .not("schedule_json", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ai_plans")
      .select("id, plan_name, created_at, workout_days ( day_name )")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const firstError = p.error || g.error || s.error || plan.error;
  if (firstError) throw firstError;

  return {
    userId: user.id,
    authEmail: user.email ?? null,
    profile: (p.data as ProfileRow) ?? null,
    goals: (g.data as unknown as GoalsRow) ?? null,
    schedule: (s.data as unknown as ScheduleRow) ?? null,
    activePlan: (plan.data as ProfileBundle["activePlan"]) ?? null,
    workoutDayNames: (((plan.data as any)?.workout_days ?? []) as { day_name: string }[]).map(
      (w) => w.day_name,
    ),
  };
}

export function initialsOf(name: string | null, email: string | null) {
  const source = (name || "").trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((s) => s[0]!.toUpperCase()).join("");
  }
  return (email || "?").slice(0, 1).toUpperCase();
}

/** Days in the parsed timetable that actually contain classes. */
export function scheduleDays(schedule: ScheduleRow | null) {
  const days = schedule?.schedule_json?.days ?? [];
  return days
    .filter((d) => (d.classes?.length ?? 0) > 0)
    .map((d) => ({ day: d.day, count: d.classes.length }));
}

export function totalClasses(schedule: ScheduleRow | null) {
  return scheduleDays(schedule).reduce((sum, d) => sum + d.count, 0);
}

/**
 * The active plan is stale when planning inputs changed after it was built.
 * Derived from persisted rows (a newer goals row or a newer *parsed* schedule);
 * `pendingChange` only covers a saved plan-affecting edit whose regeneration failed.
 */
export function isPlanStale(bundle: ProfileBundle, pendingChange = false) {
  if (!bundle.activePlan) return false;
  if (pendingChange) return true;
  const planTime = new Date(bundle.activePlan.created_at).getTime();
  const goalsTime = bundle.goals?.created_at ? new Date(bundle.goals.created_at).getTime() : 0;
  const scheduleTime = bundle.schedule?.created_at
    ? new Date(bundle.schedule.created_at).getTime()
    : 0;
  return goalsTime > planTime || scheduleTime > planTime;
}

export {
  validateEdits,
  PLAN_AFFECTING_FIELDS,
  type ProfileEdits,
  type PlanAffectingField,
} from "./profile-fields";

