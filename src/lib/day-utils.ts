// הקובץ הזה מכיל את כל העזרים לטיפול בימי השבוע — שמות, השוואה, יום נוכחי וסדר ימים מהיום.
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
// הפונקציה מנרמלת שם יום שמור למפתח אחיד (3 אותיות קטנות) להשוואה בטוחה
export function normalizeDay(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase().slice(0, 3);
}

/** 0-6 index (Sunday = 0) for a stored day_name, or -1 when unrecognised. */
// הפונקציה מחזירה את האינדקס של יום בשבוע (ראשון = 0) או -1 אם לא מוכר
export function dayIndexOf(name: string | null | undefined) {
  const key = normalizeDay(name);
  return DAY_NAMES.findIndex((d) => normalizeDay(d) === key);
}

/** Today's weekday index in the user's LOCAL timezone. */
export function todayIndex(now: Date = new Date()) {
  return now.getDay();
}

/** Today's weekday name in the user's LOCAL timezone. */
// הפונקציה מחזירה את שם היום הנוכחי באנגלית לפי אזור הזמן המקומי
export function todayName(now: Date = new Date()): DayName {
  return DAY_NAMES[now.getDay()]!;
}

/** Weekday indexes ordered starting from today, wrapping across the week. */
// הפונקציה מחזירה את אינדקסי ימי השבוע בסדר שמתחיל מהיום, עם גלילה לשבוע הבא
export function weekOrderFrom(now: Date = new Date()) {
  const start = now.getDay();
  return DAY_NAMES.map((_, i) => (start + i) % 7);
}
