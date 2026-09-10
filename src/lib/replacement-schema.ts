// הקובץ הזה מגדיר את סכמות Zod לאימות נתוני החלפת ארוחה או תרגיל, כולל תשובות ה-AI.
/**
 * Zod schemas for single-item meal / exercise replacement.
 *
 * These are deliberately separate from plan-schema.ts: a replacement never
 * produces a whole plan, and its bounds are checked against ONE item's role.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ meals */

export const MealReplacementSchema = z.object({
  meal_name: z.string().min(2).max(120),
  meal_type: z.string().min(1).max(40),
  calories: z.number().int().min(0).max(3000),
  protein: z.number().min(0).max(300),
  carbohydrates: z.number().min(0).max(600),
  fats: z.number().min(0).max(300),
  ingredients: z.array(z.string().min(1)).min(1).max(20),
  preparation_steps: z.array(z.string().min(1)).min(2).max(8),
  image_prompt: z.string().min(5).max(400),
  notes: z.string().max(300).nullable().optional().transform((v) => v ?? null),
  short_description: z.string().min(3).max(200),
  /** Explains how a specifically requested dish was adapted to the budget. */
  fit_note: z.string().max(300).nullable().optional().transform((v) => v ?? null),
});

export type MealReplacement = z.infer<typeof MealReplacementSchema>;

export const MealSuggestionsSchema = z.object({
  suggestions: z.array(MealReplacementSchema).length(3),
});

export const SpecificMealSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
  message: z.string().max(400).nullable().optional().transform((v) => v ?? null),
  meal: MealReplacementSchema.nullable().optional().transform((v) => v ?? null),
});

/** One balanced (non-locked) meal returned by the day-balancing call. */
export const BalancedMealSchema = MealReplacementSchema.pick({
  meal_name: true,
  calories: true,
  protein: true,
  carbohydrates: true,
  fats: true,
  ingredients: true,
  preparation_steps: true,
  image_prompt: true,
  notes: true,
}).extend({
  meal_order: z.number().int().min(1),
});

export type BalancedMeal = z.infer<typeof BalancedMealSchema>;

export const BalanceDaySchema = z.object({
  meals: z.array(BalancedMealSchema).min(1).max(8),
});

/* -------------------------------------------------------------- exercises */

const ExerciseFields = {
  sets: z.number().int().min(1).max(10).nullable().optional().transform((v) => v ?? null),
  reps: z.string().max(30).nullable().optional().transform((v) => v ?? null),
  duration_seconds: z
    .number()
    .int()
    .min(0)
    .max(3600)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  rest_seconds: z.number().int().min(0).max(600).nullable().optional().transform((v) => v ?? null),
  notes: z.string().max(300).nullable().optional().transform((v) => v ?? null),
  rationale: z.string().min(3).max(300),
};

const hasPrescription = (v: { reps: string | null; duration_seconds: number | null }) =>
  !!v.reps || (v.duration_seconds ?? 0) > 0;

/**
 * Slug membership is validated dynamically against the candidate pool that the
 * server itself generated, so the model physically cannot invent a slug.
 */
// הפונקציה בונה סכמת אימות להצעות תרגילים, שמכריחה slug מתוך המאגר שהשרת יצר בלבד
export function exerciseSuggestionsSchema(allowedSlugs: string[]) {
  const slug = z
    .string()
    .refine((s) => allowedSlugs.includes(s), { message: "unknown exercise_slug" });
  return z.object({
    suggestions: z
      .array(
        z
          .object({ exercise_slug: slug, ...ExerciseFields })
          .refine(hasPrescription, { message: "reps or duration_seconds is required" }),
      )
      .length(3),
  });
}

export type ExerciseSuggestion = {
  exercise_slug: string;
  sets: number | null;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number | null;
  notes: string | null;
  rationale: string;
};

/** Free-text resolution against the broader active catalogue. */
// הפונקציה בונה סכמת אימות לבקשת תרגיל ספציפי בטקסט חופשי מול הקטלוג
export function specificExerciseSchema(allowedSlugs: string[]) {
  return z.object({
    status: z.enum(["ok", "incompatible", "not_found"]),
    exercise_slug: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? null)
      .refine((s) => s === null || allowedSlugs.includes(s), {
        message: "unknown exercise_slug",
      }),
    message: z.string().max(400).nullable().optional().transform((v) => v ?? null),
    ...ExerciseFields,
    rationale: z.string().max(300).nullable().optional().transform((v) => v ?? ""),
  });
}

/* --------------------------------------------------------------- helpers */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const STALE_MESSAGE = "Your plan changed. Reopen this item to get fresh suggestions.";
