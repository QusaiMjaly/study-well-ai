import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AiPlanSchema,
  validatePlanAgainstSchedule,
  validatePlanDuration,
  validatePlanExercises,
  type AiPlan,
} from "./plan-schema";

import {
  GATEWAY_URL,
  PLAN_MODEL,
  buildPlanPrompt,
  extractJson,
  toSavePayload,
  type PlanInputs,
} from "./plan-prompt";
import { selectCandidates, type CatalogueRow } from "./exercise-selection";
import { logPlanDiagnostic } from "./plan-diagnostics";
import type { ScheduleJson } from "./schedule-schema";


export const generateAiPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ planId: string; summary: AiPlan["summary"] }> => {
    const { supabase, userId } = context;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on the server.");

    const [{ data: profile }, { data: goals }, { data: scheduleRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, age, gender, height, weight, activity_level")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("goals")
        .select(
          "goal_type, target_weight, workout_preference, meal_preference, workout_duration, preferred_time, biggest_challenge",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("schedules")
        .select("schedule_json")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!profile) throw new Error("We could not find your profile. Please complete onboarding again.");

    const inputs: PlanInputs = {
      profile,
      goals: goals ?? null,
      schedule: (scheduleRow?.schedule_json as unknown as ScheduleJson) ?? null,
    };

    const { data: catalogue } = await supabase
      .from("exercise_media")
      .select("slug, display_name, category, equipment, difficulty, primary_muscles, ymove_exercise_id")
      .eq("is_active", true);

    const candidates = selectCandidates((catalogue ?? []) as CatalogueRow[], {
      goalType: goals?.goal_type ?? null,
      activityLevel: profile.activity_level ?? null,
      workoutPreference: goals?.workout_preference ?? null,
      userId,
    });

    if (!candidates.length) {
      throw new Error("The exercise catalogue is unavailable right now. Please retry.");
    }

    const allowedSlugs = new Set(candidates.map((c) => c.slug));

    logPlanDiagnostic({
      event: "candidates",
      poolSize: candidates.length,
      families: new Set(candidates.map((c) => c.family)).size,
    });

    let problems: string[] = [];
    let plan: AiPlan | null = null;
    let attemptsUsed = 0;

    for (let attempt = 0; attempt < 2 && !plan; attempt++) {
      attemptsUsed = attempt + 1;
      logPlanDiagnostic({ event: "attempt", attempt: attemptsUsed });
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: PLAN_MODEL,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: buildPlanPrompt(inputs, candidates, attempt ? problems : undefined),
            },
          ],
        }),
      });


      if (!res.ok) {
        if (res.status === 429) throw new Error("AI is busy right now. Please retry in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Add credits to your Lovable workspace.");
        throw new Error(`AI request failed (${res.status}). Please retry.`);
      }

      const payload = await res.json();
      const raw: string = payload?.choices?.[0]?.message?.content ?? "";

      let parsedJson: unknown;
      try {
        parsedJson = extractJson(raw);
      } catch {
        problems = ["The response was not valid JSON."];
        logPlanDiagnostic({
          event: "validation",
          attempt: attemptsUsed,
          passed: false,
          reason: "invalid_json",
        });
        continue;
      }

      const parsed = AiPlanSchema.safeParse(parsedJson);
      if (!parsed.success) {
        problems = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`);
        logPlanDiagnostic({
          event: "validation",
          attempt: attemptsUsed,
          passed: false,
          reason: "schema",
          problemCount: parsed.error.issues.length,
        });
        continue;
      }

      const scheduleProblems = validatePlanAgainstSchedule(parsed.data, inputs.schedule);
      const exerciseProblems = validatePlanExercises(parsed.data, allowedSlugs);
      const durationProblems = validatePlanDuration(parsed.data, goals?.workout_duration ?? null);
      if (scheduleProblems.length || exerciseProblems.length || durationProblems.length) {
        problems = [...scheduleProblems, ...exerciseProblems, ...durationProblems].slice(0, 8);
        logPlanDiagnostic({
          event: "validation",
          attempt: attemptsUsed,
          passed: false,
          reason: exerciseProblems.length
            ? "exercises"
            : scheduleProblems.length
              ? "schedule"
              : "duration",
          problemCount:
            scheduleProblems.length + exerciseProblems.length + durationProblems.length,
        });
        continue;
      }


      logPlanDiagnostic({ event: "validation", attempt: attemptsUsed, passed: true });
      plan = parsed.data;
    }

    if (!plan) {
      throw new Error(
        `The AI plan failed validation: ${problems.slice(0, 3).join(" ")} Please retry.`,
      );
    }

    const { data: planId, error: saveErr } = await supabase.rpc(
      "save_ai_plan" as never,
      { _plan: toSavePayload(plan, PLAN_MODEL) } as never,
    );

    if (saveErr) {
      throw new Error(`Your plan could not be saved (nothing was stored): ${saveErr.message}`);
    }

    logPlanDiagnostic({
      event: "saved",
      attempts: attemptsUsed,
      workoutDays: plan.workout_days.length,
      exercises: plan.workout_days.reduce((n, d) => n + d.exercises.length, 0),
    });

    return { planId: planId as unknown as string, summary: plan.summary };
  });
