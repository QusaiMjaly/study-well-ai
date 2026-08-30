/**
 * Pure, client-safe profile/goals field helpers.
 *
 * Kept free of any Supabase import so both the browser UI and server functions
 * can share validation, normalization and the plan-affecting field list.
 */

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

export const num = (v: string) => (v.trim() === "" ? null : Number(v));

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

/**
 * Every field whose value is actually read by AI plan generation
 * (see PlanInputs / buildPlanPrompt / selectCandidates).
 * `full_name` is deliberately excluded: it is only a greeting.
 */
export const PLAN_AFFECTING_FIELDS = [
  "age",
  "gender",
  "height",
  "weight",
  "activity_level",
  "goal_type",
  "target_weight",
  "workout_preference",
  "meal_preference",
  "workout_duration",
  "preferred_time",
  "biggest_challenge",
] as const;

export type PlanAffectingField = (typeof PLAN_AFFECTING_FIELDS)[number];

export type PlanFieldSnapshot = Record<PlanAffectingField, string | number | null>;

const NUMERIC: ReadonlySet<string> = new Set(["age", "height", "weight", "target_weight"]);

/** Normalizes a raw stored/edited value so 70, "70", "70.0" and "" compare consistently. */
function normalizeValue(field: PlanAffectingField, value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (NUMERIC.has(field)) {
    const n = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
  }
  const s = String(value).trim();
  return s === "" ? null : s;
}

export function snapshotFrom(source: Record<string, unknown>): PlanFieldSnapshot {
  const out = {} as PlanFieldSnapshot;
  for (const field of PLAN_AFFECTING_FIELDS) {
    out[field] = normalizeValue(field, source[field]);
  }
  return out;
}

/** Plan-affecting fields whose committed value differs from the previous one. */
export function diffPlanFields(
  previous: PlanFieldSnapshot,
  next: PlanFieldSnapshot,
): PlanAffectingField[] {
  return PLAN_AFFECTING_FIELDS.filter((f) => previous[f] !== next[f]);
}

/** Columns stored on `profiles`. */
export const PROFILE_COLUMNS = [
  "full_name",
  "age",
  "gender",
  "height",
  "weight",
  "activity_level",
] as const;

/** Columns stored on an appended `goals` row (excluding workout_days, which is carried over). */
export const GOALS_COLUMNS = [
  "goal_type",
  "target_weight",
  "workout_preference",
  "meal_preference",
  "workout_duration",
  "preferred_time",
  "biggest_challenge",
] as const;

/** Normalizes any profile/goals column so 70, "70", "70.0", "" and null compare consistently. */
export function normalizeField(field: string, value: unknown): string | number | null {
  return normalizeValue(field as PlanAffectingField, value);
}

/** Columns from `fields` whose normalized value differs between the two sources. */
export function diffColumns(
  fields: readonly string[],
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  return fields.filter((f) => normalizeField(f, previous[f]) !== normalizeField(f, next[f]));
}
