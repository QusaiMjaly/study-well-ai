import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildExerciseSuggestionsPrompt,
  buildSpecificExercisePrompt,
  callStructuredJson,
} from "./replacement-prompt";
import {
  ISO_DATE,
  exerciseSuggestionsSchema,
  specificExerciseSchema,
} from "./replacement-schema";
import { loadExercise, loadUserContext } from "./replacement-core";
import {
  buildReplacementPool,
  contextCompatible,
  mergePools,
  searchCatalogue,
  toCandidates,
} from "./exercise-candidates";
import type { CatalogueRow } from "./exercise-selection";

const Target = z.object({
  exerciseId: z.string().uuid(),
  planId: z.string().uuid(),
});

export type ExerciseOption = {
  exercise_slug: string;
  exercise_name: string;
  muscle: string;
  family: string;
  equipment: string;
  difficulty: string;
  sets: number | null;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number | null;
  notes: string | null;
  rationale: string;
};

export type SpecificExerciseResult =
  | { status: "ok"; option: ExerciseOption; message: string | null }
  | { status: "incompatible"; exerciseName: string; message: string }
  | { status: "not_found"; message: string };

export type ExerciseApplyResult =
  | { status: "needs_confirmation" }
  | { status: "applied"; exerciseId: string; exerciseSlug: string; exerciseName: string };

const CATALOGUE_COLUMNS =
  "slug, display_name, category, equipment, difficulty, primary_muscles, ymove_exercise_id";

async function loadCatalogue(supabase: any) {
  const { data } = await supabase.from("exercise_media").select(CATALOGUE_COLUMNS).eq("is_active", true);
  return toCandidates((data ?? []) as CatalogueRow[]);
}

export const suggestExerciseReplacements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Target.parse(d))
  .handler(async ({ data, context }): Promise<{ suggestions: ExerciseOption[] }> => {
    const { supabase, userId } = context;
    const { exercise, day, dayExercises } = await loadExercise(
      supabase,
      data.exerciseId,
      data.planId,
    );
    const user = await loadUserContext(supabase, userId);
    const all = await loadCatalogue(supabase);
    const original = all.find((c) => c.slug === exercise.exercise_slug) ?? null;

    const pool = buildReplacementPool(all, original, {
      workoutPreference: user.workout_preference,
      activityLevel: user.activity_level,
      excludeSlugs: dayExercises.map((e) => e.exercise_slug).filter(Boolean) as string[],
      originalSlug: exercise.exercise_slug,
    });
    if (pool.length < 3) {
      throw new Error("There aren't enough alternatives for this exercise right now.");
    }

    const raw = await callStructuredJson(
      buildExerciseSuggestionsPrompt(
        {
          user,
          workoutTitle: day.workout_title,
          workoutType: day.workout_type,
          durationMinutes: day.duration_minutes,
          original: {
            exercise_name: exercise.exercise_name,
            exercise_slug: exercise.exercise_slug,
            sets: exercise.sets,
            reps: exercise.reps,
            duration_seconds: exercise.duration_seconds,
            rest_seconds: exercise.rest_seconds,
            family: original?.family ?? null,
            muscle: original?.muscle ?? null,
          },
          otherExercises: dayExercises
            .filter((e) => e.id !== exercise.id)
            .map((e) => e.exercise_name),
        },
        pool,
      ),
    );

    const parsed = exerciseSuggestionsSchema(pool.map((p) => p.slug)).safeParse(raw);
    if (!parsed.success) {
      throw new Error("The AI suggestions were incomplete. Please try again.");
    }

    const seen = new Set<string>();
    const suggestions: ExerciseOption[] = [];
    for (const s of parsed.data.suggestions) {
      if (seen.has(s.exercise_slug)) continue;
      seen.add(s.exercise_slug);
      const c = pool.find((p) => p.slug === s.exercise_slug)!;
      suggestions.push({
        exercise_slug: c.slug,
        exercise_name: c.name,
        muscle: c.muscle,
        family: c.family,
        equipment: c.equipment,
        difficulty: c.difficulty,
        sets: s.sets,
        reps: s.reps,
        duration_seconds: s.duration_seconds,
        rest_seconds: s.rest_seconds,
        notes: s.notes,
        rationale: s.rationale,
      });
    }
    if (!suggestions.length) throw new Error("The AI suggestions were incomplete. Please try again.");
    return { suggestions };
  });

export const requestSpecificExerciseReplacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    Target.extend({ request: z.string().trim().min(2).max(80) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SpecificExerciseResult> => {
    const { supabase, userId } = context;
    const { exercise, day, dayExercises } = await loadExercise(
      supabase,
      data.exerciseId,
      data.planId,
    );
    const user = await loadUserContext(supabase, userId);
    const all = await loadCatalogue(supabase);
    const original = all.find((c) => c.slug === exercise.exercise_slug) ?? null;

    const poolCtx = {
      workoutPreference: user.workout_preference,
      activityLevel: user.activity_level,
      excludeSlugs: dayExercises
        .filter((e) => e.id !== exercise.id)
        .map((e) => e.exercise_slug)
        .filter(Boolean) as string[],
      originalSlug: exercise.exercise_slug,
    };

    // Lookup pool spans the WHOLE active catalogue so an existing exercise is
    // never reported missing merely because it conflicts with home/gym context.
    const lookup = searchCatalogue(all, data.request);
    const contextPool = buildReplacementPool(all, original, poolCtx);
    const prompt = mergePools(lookup, contextPool);
    const compatibleSlugs = new Set(contextCompatible(all, poolCtx).map((c) => c.slug));

    const raw = await callStructuredJson(
      buildSpecificExercisePrompt(
        {
          user,
          workoutTitle: day.workout_title,
          workoutType: day.workout_type,
          durationMinutes: day.duration_minutes,
          original: {
            exercise_name: exercise.exercise_name,
            exercise_slug: exercise.exercise_slug,
            sets: exercise.sets,
            reps: exercise.reps,
            duration_seconds: exercise.duration_seconds,
            rest_seconds: exercise.rest_seconds,
            family: original?.family ?? null,
            muscle: original?.muscle ?? null,
          },
          otherExercises: dayExercises
            .filter((e) => e.id !== exercise.id)
            .map((e) => e.exercise_name),
        },
        prompt,
        data.request,
        (user.workout_preference ?? "no_preference").toLowerCase() === "home"
          ? "training at home with bodyweight / mat / band only"
          : "gym access with standard equipment",
        prompt.filter((c) => compatibleSlugs.has(c.slug)).map((c) => c.slug),
      ),
    );

    const parsed = specificExerciseSchema(prompt.map((p) => p.slug)).safeParse(raw);
    if (!parsed.success) {
      return {
        status: "not_found",
        message: "We couldn't match that exercise. Try another name.",
      };
    }

    const r = parsed.data;
    const match = r.exercise_slug ? prompt.find((p) => p.slug === r.exercise_slug) : null;

    if (!match || r.status === "not_found") {
      return {
        status: "not_found",
        message:
          r.message ?? "That exercise isn't in our demo library. Try a different name.",
      };
    }

    // Server-side context check — the model never decides compatibility alone.
    if (r.status !== "ok" || !compatibleSlugs.has(match.slug)) {
      return {
        status: "incompatible",
        exerciseName: match.name,
        message:
          r.message ??
          `${match.name} needs ${match.equipment.replace(/_/g, " ")}, which doesn't fit your current training setup. Pick one of the suggested alternatives instead.`,
      };
    }

    if (poolCtx.excludeSlugs.includes(match.slug)) {
      return {
        status: "incompatible",
        exerciseName: match.name,
        message: `${match.name} is already in this workout. Choose a different exercise.`,
      };
    }

    return {
      status: "ok",
      message: r.message,
      option: {
        exercise_slug: match.slug,
        exercise_name: match.name,
        muscle: match.muscle,
        family: match.family,
        equipment: match.equipment,
        difficulty: match.difficulty,
        sets: r.sets ?? exercise.sets,
        reps: r.reps ?? (r.duration_seconds ? null : exercise.reps),
        duration_seconds: r.duration_seconds,
        rest_seconds: r.rest_seconds ?? exercise.rest_seconds,
        notes: r.notes,
        rationale: r.rationale || "Matches your request and fits this workout.",
      },
    };
  });

export const applyExerciseReplacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    Target.extend({
      expectedSlug: z.string().nullable(),
      expectedOrder: z.number().int().min(1),
      today: z.string().regex(ISO_DATE),
      confirmCompleted: z.boolean().default(false),
      selection: z.object({
        exercise_slug: z.string().min(1),
        sets: z.number().int().min(1).max(10).nullable(),
        reps: z.string().max(30).nullable(),
        duration_seconds: z.number().int().min(0).max(3600).nullable(),
        rest_seconds: z.number().int().min(0).max(600).nullable(),
        notes: z.string().max(300).nullable(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ExerciseApplyResult> => {
    const { supabase, userId } = context;
    const { exercise, day, dayExercises } = await loadExercise(
      supabase,
      data.exerciseId,
      data.planId,
    );

    if (
      (exercise.exercise_slug ?? null) !== data.expectedSlug ||
      exercise.exercise_order !== data.expectedOrder
    ) {
      throw new Error("Your plan changed. Reopen this item to get fresh suggestions.");
    }

    // The persisted exercise must always be an ACTIVE canonical catalogue slug.
    const { data: canonical } = await supabase
      .from("exercise_media")
      .select("slug, display_name")
      .eq("slug", data.selection.exercise_slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!canonical) {
      throw new Error("That exercise is no longer available. Please pick another one.");
    }

    if (
      dayExercises.some((e) => e.id !== exercise.id && e.exercise_slug === canonical.slug)
    ) {
      throw new Error("That exercise is already in this workout. Please pick another one.");
    }

    const { data: completion } = await supabase
      .from("workout_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("workout_day_id", day.id)
      .eq("exercise_id", exercise.id)
      .eq("completed_on", data.today)
      .maybeSingle();

    if (completion && !data.confirmCompleted) return { status: "needs_confirmation" };

    // Update first: if this fails, today's completion is still intact.
    const { error } = await supabase
      .from("workout_exercises")
      .update({
        exercise_name: canonical.display_name,
        exercise_slug: canonical.slug,
        sets: data.selection.sets,
        reps: data.selection.reps,
        duration_seconds: data.selection.duration_seconds,
        rest_seconds: data.selection.rest_seconds,
        notes: data.selection.notes,
      })
      .eq("id", exercise.id);
    if (error) throw new Error("The replacement could not be saved. Please try again.");

    if (completion) {
      // Only today's row for this exact exercise; history is never touched.
      const { error: delErr } = await supabase
        .from("workout_completions")
        .delete()
        .eq("user_id", userId)
        .eq("workout_day_id", day.id)
        .eq("exercise_id", exercise.id)
        .eq("completed_on", data.today);
      if (delErr) throw new Error("We couldn't update today's log. Please try again.");
    }

    return {
      status: "applied",
      exerciseId: exercise.id,
      exerciseSlug: canonical.slug,
      exerciseName: canonical.display_name,
    };
  });
