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
      .limit(1)
      .maybeSingle(),
    supabase
      .from("schedules")
      .select("id, image_url, schedule_json, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
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
 * The active plan is stale when profile/goals data used to build it changed afterwards.
 * `goals` rows are append-only from onboarding, so a newer goals row means newer inputs.
 */
export function isPlanStale(bundle: ProfileBundle, editedAt: number | null) {
  if (!bundle.activePlan) return false;
  const planTime = new Date(bundle.activePlan.created_at).getTime();
  if (editedAt && editedAt > planTime) return true;
  const goalsTime = bundle.goals?.created_at ? new Date(bundle.goals.created_at).getTime() : 0;
  return goalsTime > planTime;
}

export type ProfileEdits = {
  full_name: string;
  age: string;
  gender: string;
  height: string;
  weight: string;
  activity_level: string;
  goal_type: string;
  target_weight: string;
  workout_preference: string;
  meal_preference: string;
  workout_duration: string;
  preferred_time: string;
  biggest_challenge: string;
};

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function validateEdits(e: ProfileEdits): string | null {
  if (!e.full_name.trim()) return "Please enter your full name.";
  if (e.full_name.trim().length > 100) return "Name must be under 100 characters.";
  const age = num(e.age);
  if (age !== null && (!Number.isFinite(age) || age < 13 || age > 100))
    return "Age must be between 13 and 100.";
  const height = num(e.height);
  if (height !== null && (!Number.isFinite(height) || height < 100 || height > 250))
    return "Height must be between 100 and 250 cm.";
  const weight = num(e.weight);
  if (weight !== null && (!Number.isFinite(weight) || weight < 30 || weight > 300))
    return "Weight must be between 30 and 300 kg.";
  const target = num(e.target_weight);
  if (target !== null && (!Number.isFinite(target) || target < 30 || target > 300))
    return "Target weight must be between 30 and 300 kg.";
  if (e.biggest_challenge.length > 300) return "Challenge must be under 300 characters.";
  return null;
}

/** Updates only the signed-in user's own profile + latest goals row. */
export async function saveProfileEdits(bundle: ProfileBundle, e: ProfileEdits) {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { error: pErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: bundle.profile?.email ?? bundle.authEmail,
      full_name: e.full_name.trim(),
      age: num(e.age),
      gender: e.gender || null,
      height: num(e.height),
      weight: num(e.weight),
      activity_level: e.activity_level || null,
    },
    { onConflict: "id" },
  );
  if (pErr) throw pErr;

  const goalPayload = {
    user_id: userId,
    goal_type: e.goal_type || null,
    target_weight: num(e.target_weight),
    workout_preference: e.workout_preference || null,
    meal_preference: e.meal_preference || null,
    workout_duration: e.workout_duration || null,
    preferred_time: e.preferred_time || null,
    biggest_challenge: e.biggest_challenge.trim() || null,
    workout_days: bundle.goals?.workout_days ?? null,
  };

  if (bundle.goals?.id) {
    const { error } = await supabase
      .from("goals")
      .update(goalPayload)
      .eq("id", bundle.goals.id)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("goals").insert(goalPayload);
    if (error) throw error;
  }
}
