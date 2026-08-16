/**
 * Single source of truth for weekday handling.
 *
 * Every screen (Home, Meals, Workout, Recovery Day, Profile) must use these
 * helpers so they can never disagree about "what day is it".
 *
 * Rules:
 * - Sunday-first array, matching JavaScript's local `Date.getDay()` (Sunday = 0).
 * - Comparisons are case/whitespace-insensitive on the first 3 letters, so the
 *   plan's stored values ("sunday", "Sunday", "Sun") all match.
 * - Everything is computed from the LOCAL calendar date, never UTC.
 */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type DayName = (typeof DAY_NAMES)[number];

/** Canonical comparison key for any stored day_name value. */
export function normalizeDay(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase().slice(0, 3);
}

/** 0-6 index (Sunday = 0) for a stored day_name, or -1 when unrecognised. */
export function dayIndexOf(name: string | null | undefined) {
  const key = normalizeDay(name);
  return DAY_NAMES.findIndex((d) => normalizeDay(d) === key);
}

/** Today's weekday index in the user's LOCAL timezone. */
export function todayIndex(now: Date = new Date()) {
  return now.getDay();
}

/** Today's weekday name in the user's LOCAL timezone. */
export function todayName(now: Date = new Date()): DayName {
  return DAY_NAMES[now.getDay()]!;
}

/** Weekday indexes ordered starting from today, wrapping across the week. */
export function weekOrderFrom(now: Date = new Date()) {
  const start = now.getDay();
  return DAY_NAMES.map((_, i) => (start + i) % 7);
}
