/** Shared, predefined option lists for the Profile edit form (mirrors onboarding). */

export type Option = { value: string; label: string };

export const GENDERS: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const ACTIVITY_LEVELS: Option[] = [
  { value: "sedentary", label: "Sedentary — little to no exercise" },
  { value: "light", label: "Lightly active — 1-3 days/week" },
  { value: "moderate", label: "Moderately active — 3-5 days/week" },
  { value: "very", label: "Very active — 6-7 days/week" },
];

export const GOALS: Option[] = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "gain_muscle", label: "Build muscle" },
  { value: "maintain", label: "Stay fit" },
  { value: "improve_energy", label: "Improve health" },
];

export const WORKOUT_PREFS: Option[] = [
  { value: "gym", label: "Gym" },
  { value: "home", label: "Home" },
  { value: "no_preference", label: "No preference" },
];

export const MEAL_PREFS: Option[] = [
  { value: "balanced", label: "Balanced" },
  { value: "high_protein", label: "High protein" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "low_carb", label: "Low carb" },
];

export const DURATIONS: Option[] = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "flexible", label: "Flexible" },
];

export const TIMES: Option[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "flexible", label: "Flexible" },
];

export const CHALLENGES: Option[] = [
  { value: "motivation", label: "Motivation" },
  { value: "time", label: "Not enough time" },
  { value: "consistency", label: "Staying consistent" },
  { value: "nutrition", label: "Eating well" },
];

/** Human label for a stored value; falls back to a readable version of unknown data. */
export function labelOf(list: Option[], value: string | null | undefined) {
  if (!value) return "";
  return list.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ");
}
