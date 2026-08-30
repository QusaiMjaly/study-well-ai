import { z } from "zod";
import { DAYS, type ScheduleJson } from "./schedule-schema";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ExerciseSchema = z.object({
  exercise_order: z.number().int().min(1),
  exercise_name: z.string().min(1),
  sets: z.number().int().min(1).nullable().optional().transform((v) => v ?? null),
  reps: z.string().nullable().optional().transform((v) => v ?? null),
  duration_seconds: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
  rest_seconds: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
  // Canonical demo-library id when an accurate match exists; null otherwise.
  exercise_slug: z.string().nullable().optional().transform((v) => v ?? null),
});

export const WorkoutDaySchema = z.object({
  day_name: z.enum(DAYS),
  workout_title: z.string().min(1),
  workout_type: z.string().min(1),
  duration_minutes: z.number().int().min(5).max(240),
  estimated_calories: z.number().int().min(0).max(3000),
  scheduled_start: z.string().regex(TIME),
  scheduled_end: z.string().regex(TIME),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
  exercises: z.array(ExerciseSchema).min(1),
});

export const MealItemSchema = z.object({
  meal_order: z.number().int().min(1),
  meal_name: z.string().min(1),
  meal_type: z.string().min(1),
  scheduled_time: z.string().regex(TIME),
  calories: z.number().int().min(0).max(3000),
  protein: z.number().min(0).max(300),
  carbohydrates: z.number().min(0).max(600),
  fats: z.number().min(0).max(300),
  ingredients: z.array(z.string().min(1)).default([]),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
  // Backward compatible: older plans have neither field.
  preparation_steps: z.array(z.string().min(1)).optional().default([]),
  image_prompt: z.string().nullable().optional().transform((v) => v ?? null),
});

export const MealDaySchema = z.object({
  day_name: z.enum(DAYS),
  total_calories: z.number().int().min(800).max(6000),
  protein: z.number().min(0).max(500),
  carbohydrates: z.number().min(0).max(1000),
  fats: z.number().min(0).max(400),
  meals: z.array(MealItemSchema).min(2),
});

export const DailyTipSchema = z.object({
  day_name: z.enum(DAYS),
  tip_text: z.string().min(5),
});

export const AiPlanSchema = z.object({
  summary: z.object({
    goal: z.string().min(1),
    daily_calories: z.number().int().min(800).max(6000),
    daily_protein: z.number().min(0).max(500),
    weekly_workouts: z.number().int().min(1).max(14),
  }),
  workout_days: z.array(WorkoutDaySchema).min(1),
  meal_days: z.array(MealDaySchema).min(1),
  daily_tips: z.array(DailyTipSchema).min(1),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Business validation on top of the shape validation.
 * Returns a list of human readable problems; empty means the plan is acceptable.
 */
export function validatePlanAgainstSchedule(
  plan: AiPlan,
  schedule: ScheduleJson | null,
): string[] {
  const problems: string[] = [];

  const classesFor = (day: string) =>
    schedule?.days.find((d) => d.day === day)?.classes ?? [];

  // Workouts: valid range, no duplicates per day, never overlapping a class.
  const seenWorkoutDays = new Set<string>();
  for (const w of plan.workout_days) {
    const start = toMin(w.scheduled_start);
    const end = toMin(w.scheduled_end);
    if (end <= start) {
      problems.push(`Workout on ${w.day_name} has an invalid time range.`);
      continue;
    }
    if (seenWorkoutDays.has(w.day_name)) {
      problems.push(`More than one workout scheduled on ${w.day_name}.`);
      continue;
    }
    seenWorkoutDays.add(w.day_name);

    for (const c of classesFor(w.day_name)) {
      if (start < toMin(c.end_time) && toMin(c.start_time) < end) {
        problems.push(
          `Workout on ${w.day_name} (${w.scheduled_start}-${w.scheduled_end}) overlaps class "${c.course_name}".`,
        );
      }
    }
  }

  // Meals: must not fall inside a class block.
  for (const d of plan.meal_days) {
    const orders = new Set<number>();
    for (const m of d.meals) {
      if (orders.has(m.meal_order)) {
        problems.push(`Duplicate meal order ${m.meal_order} on ${d.day_name}.`);
      }
      orders.add(m.meal_order);

      const t = toMin(m.scheduled_time);
      for (const c of classesFor(d.day_name)) {
        if (t >= toMin(c.start_time) && t < toMin(c.end_time)) {
          problems.push(
            `Meal "${m.meal_name}" on ${d.day_name} at ${m.scheduled_time} falls during class "${c.course_name}".`,
          );
        }
      }
    }
  }

  return problems;
}

/** Structure envelope implied by the stored workout_duration preference. */
export type DurationBand = {
  label: string;
  minMinutes: number;
  maxMinutes: number;
  minExercises: number;
  maxExercises: number;
  guidance: string;
};

const BANDS: Record<string, DurationBand> = {
  "15": {
    label: "15 minutes",
    minMinutes: 12,
    maxMinutes: 22,
    minExercises: 3,
    maxExercises: 5,
    guidance: "3-5 exercises, 2 sets each, 30-45s rest, circuit style, minimal setup changes",
  },
  "30": {
    label: "30 minutes",
    minMinutes: 24,
    maxMinutes: 38,
    minExercises: 4,
    maxExercises: 6,
    guidance: "4-6 exercises, 3 sets each, 45-60s rest",
  },
  "45": {
    label: "45 minutes",
    minMinutes: 36,
    maxMinutes: 55,
    minExercises: 5,
    maxExercises: 8,
    guidance: "5-8 exercises, 3-4 sets each, 60-90s rest, compound work first",
  },
  "60": {
    label: "60 minutes",
    minMinutes: 48,
    maxMinutes: 75,
    minExercises: 6,
    maxExercises: 10,
    guidance:
      "6-10 exercises, 3-4 sets each, 60-120s rest, compound work first plus accessory/isolation work",
  },
};

const FLEXIBLE_BAND: DurationBand = {
  label: "flexible (aim for 30-45 minutes)",
  minMinutes: 25,
  maxMinutes: 60,
  minExercises: 4,
  maxExercises: 8,
  guidance: "4-8 exercises, 3 sets each, 45-90s rest",
};

export function durationBand(preference: string | null | undefined): DurationBand {
  const key = (preference ?? "").trim();
  return BANDS[key] ?? FLEXIBLE_BAND;
}

/**
 * Ensures the generated workouts actually fit the requested session length:
 * duration, scheduled window and exercise volume must agree with the band.
 */
export function validatePlanDuration(plan: AiPlan, preference: string | null | undefined): string[] {
  const band = durationBand(preference);
  const problems: string[] = [];

  for (const w of plan.workout_days) {
    if (w.duration_minutes < band.minMinutes || w.duration_minutes > band.maxMinutes) {
      problems.push(
        `Workout on ${w.day_name} lasts ${w.duration_minutes} min but the student asked for ${band.label}; use ${band.minMinutes}-${band.maxMinutes} min.`,
      );
    }
    const span = toMin(w.scheduled_end) - toMin(w.scheduled_start);
    if (Math.abs(span - w.duration_minutes) > 5) {
      problems.push(
        `Workout on ${w.day_name} is scheduled for ${span} min but duration_minutes says ${w.duration_minutes}; they must match.`,
      );
    }
    const count = w.exercises.length;
    if (count < band.minExercises || count > band.maxExercises) {
      problems.push(
        `Workout on ${w.day_name} has ${count} exercises; a ${band.label} session needs ${band.minExercises}-${band.maxExercises}.`,
      );
    }
  }

  return problems;
}

/**
 * Validates that every generated exercise uses a slug from the candidate pool
 * that was supplied to the model for THIS generation. No fuzzy remapping.
 */
export function validatePlanExercises(plan: AiPlan, allowedSlugs: Set<string>): string[] {
  const problems: string[] = [];
  const invalid = new Set<string>();

  for (const day of plan.workout_days) {
    const seen = new Set<string>();
    for (const ex of day.exercises) {
      const slug = ex.exercise_slug;
      if (!slug) {
        problems.push(
          `Exercise "${ex.exercise_name}" on ${day.day_name} is missing "exercise_slug".`,
        );
        continue;
      }
      if (!allowedSlugs.has(slug)) {
        invalid.add(slug);
        continue;
      }
      if (seen.has(slug)) {
        problems.push(`Exercise "${slug}" is repeated in the ${day.day_name} workout.`);
      }
      seen.add(slug);
    }
  }

  if (invalid.size) {
    problems.push(
      `Use only exercise_slug values from the provided allowed exercise catalogue. Invalid slugs in your last attempt: ${[...invalid].slice(0, 12).join(", ")}.`,
    );
  }

  return problems;
}

