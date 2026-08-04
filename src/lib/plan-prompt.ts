import type { ScheduleJson } from "./schedule-schema";
import type { AiPlan } from "./plan-schema";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const PLAN_MODEL = "google/gemini-3-flash-preview";

export type PlanInputs = {
  profile: {
    full_name: string | null;
    age: number | null;
    gender: string | null;
    height: number | null;
    weight: number | null;
    activity_level: string | null;
  } | null;
  goals: {
    goal_type: string | null;
    workout_preference: string | null;
    meal_preference: string | null;
    workout_duration: string | null;
    preferred_time: string | null;
    biggest_challenge: string | null;
  } | null;
  schedule: ScheduleJson | null;
};

export function buildPlanPrompt(inputs: PlanInputs, retryProblems?: string[]) {
  const { profile, goals, schedule } = inputs;

  const scheduleText = schedule
    ? schedule.days
        .map((d) => {
          const classes = d.classes.length
            ? d.classes.map((c) => `${c.start_time}-${c.end_time} ${c.course_name}`).join("; ")
            : "no classes";
          const free = d.free_slots.length
            ? d.free_slots.map((s) => `${s.start_time}-${s.end_time}`).join(", ")
            : "none";
          return `${d.day}: classes [${classes}] | free [${free}]`;
        })
        .join("\n")
    : "No timetable available. Assume classes 09:00-15:00 Sunday to Thursday.";

  return `You are a university student fitness and nutrition coach. Build ONE personalised weekly plan.

STUDENT
- Name: ${profile?.full_name ?? "student"}
- Age: ${profile?.age ?? "unknown"}, Gender: ${profile?.gender ?? "unknown"}
- Height: ${profile?.height ?? "unknown"} cm, Weight: ${profile?.weight ?? "unknown"} kg
- Activity level: ${profile?.activity_level ?? "moderate"}
- Goal: ${goals?.goal_type ?? "maintain"}
- Workout location preference: ${goals?.workout_preference ?? "no_preference"}
- Meal preference: ${goals?.meal_preference ?? "balanced"}
- Workout duration preference: ${goals?.workout_duration ?? "flexible"} (minutes, or "flexible")
- Preferred workout time: ${goals?.preferred_time ?? "flexible"}
- Biggest challenge: ${goals?.biggest_challenge ?? "consistency"}

WEEKLY TIMETABLE (24h, timezone ${schedule?.timezone ?? "Asia/Jerusalem"})
${scheduleText}

HARD RULES
- Workouts MUST fit entirely inside a free slot and must NEVER overlap any class.
- At most ONE workout per day. 3 to 6 workouts per week.
- Workout length must match the duration preference (use 30-45 min when "flexible").
- Respect the preferred workout time (morning <12:00, afternoon 12:00-17:00, evening >=17:00) when a free slot allows it.
- Respect the workout location preference (gym equipment only when "gym"; bodyweight/minimal when "home").
- Meals must NEVER be scheduled during a class. Provide 3 to 5 meals per day.
- Calories and protein must be realistic for the student's stats and goal (Mifflin-St Jeor + activity factor).
- meal_days must cover all 7 days: sunday, monday, tuesday, wednesday, thursday, friday, saturday.
- daily_tips must contain one short motivational/coaching tip for each of the 7 days.
- Times are strings in 24h "HH:mm" format. Day names lowercase English.
${retryProblems?.length ? `\nYOUR PREVIOUS ATTEMPT WAS REJECTED. Fix these problems:\n- ${retryProblems.join("\n- ")}` : ""}

OUTPUT
Return JSON only, no markdown, no explanation, exactly this shape:
{
  "summary": { "goal": "", "daily_calories": 0, "daily_protein": 0, "weekly_workouts": 0 },
  "workout_days": [
    { "day_name": "monday", "workout_title": "", "workout_type": "", "duration_minutes": 45,
      "estimated_calories": 320, "scheduled_start": "17:00", "scheduled_end": "17:45", "notes": "",
      "exercises": [ { "exercise_order": 1, "exercise_name": "", "sets": 3, "reps": "12", "duration_seconds": null, "rest_seconds": 60, "notes": "" } ] }
  ],
  "meal_days": [
    { "day_name": "monday", "total_calories": 2200, "protein": 130, "carbohydrates": 250, "fats": 70,
      "meals": [ { "meal_order": 1, "meal_name": "", "meal_type": "breakfast", "scheduled_time": "08:00",
        "calories": 450, "protein": 30, "carbohydrates": 50, "fats": 12, "ingredients": ["oats"], "notes": "" } ] }
  ],
  "daily_tips": [ { "day_name": "monday", "tip_text": "" } ]
}`;
}

/** Flattens the validated plan into the payload the save_ai_plan database routine expects. */
export function toSavePayload(plan: AiPlan, model: string) {
  return {
    plan_name: `${plan.summary.goal} plan`,
    ai_model: model,
    generation_version: 1,
    workout_days: plan.workout_days,
    meal_days: plan.meal_days,
    daily_tips: plan.daily_tips,
  };
}

export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned);
}
