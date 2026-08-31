/**
 * Prompt construction + one shared structured-JSON gateway call for single-item
 * meal / exercise replacement. Pure string building only — no persistence.
 */
import { GATEWAY_URL, PLAN_MODEL, extractJson } from "./plan-prompt";
import type { Candidate } from "./exercise-selection";

export type UserContext = {
  age: number | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  activity_level: string | null;
  goal_type: string | null;
  target_weight: number | null;
  workout_preference: string | null;
  meal_preference: string | null;
  workout_duration: string | null;
  biggest_challenge: string | null;
};

export function userContextText(u: UserContext) {
  return [
    `- Age: ${u.age ?? "unknown"}, Gender: ${u.gender ?? "unknown"}`,
    `- Height: ${u.height ?? "unknown"} cm, Weight: ${u.weight ?? "unknown"} kg`,
    `- Activity level: ${u.activity_level ?? "moderate"}`,
    `- Goal: ${u.goal_type ?? "maintain"} (target weight ${u.target_weight ?? "not set"} kg)`,
    `- Training context: ${u.workout_preference ?? "no_preference"}, sessions of ${u.workout_duration ?? "flexible"} minutes`,
    `- Meal preference: ${u.meal_preference ?? "balanced"}`,
    `- Biggest challenge: ${u.biggest_challenge ?? "consistency"}`,
  ].join("\n");
}

/** One structured Gemini call. Throws friendly errors; never leaks provider text. */
export async function callStructuredJson(prompt: string): Promise<unknown> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured on the server.");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: PLAN_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("AI is busy right now. Please retry in a moment.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits to your Lovable workspace.");
    throw new Error(`AI request failed (${res.status}). Please retry.`);
  }

  const payload = await res.json();
  const raw: string = payload?.choices?.[0]?.message?.content ?? "";
  try {
    return extractJson(raw);
  } catch {
    throw new Error("The AI response could not be read. Please retry.");
  }
}

/* ------------------------------------------------------------------ meals */

export type MealContext = {
  user: UserContext;
  dayName: string;
  /** Daily targets for the day this meal belongs to. */
  targetCalories: number;
  targetProtein: number;
  original: {
    meal_name: string;
    meal_type: string | null;
    scheduled_time: string | null;
    calories: number | null;
    protein: number | null;
    carbohydrates: number | null;
    fats: number | null;
  };
  /** Other meals of the same day (name + calories) for coherence. */
  otherMeals: { meal_name: string; calories: number | null }[];
};

const MEAL_JSON_SHAPE = `{
  "meal_name": "", "meal_type": "", "calories": 0, "protein": 0, "carbohydrates": 0, "fats": 0,
  "ingredients": ["..."], "preparation_steps": ["...", "..."],
  "image_prompt": "one short sentence describing the finished plated dish",
  "notes": "", "short_description": "one short line the student reads when choosing", "fit_note": null
}`;

export type SpecificMealMode = "fit_plan" | "as_described";

function mealContextText(c: MealContext, asDescribed = false) {
  if (asDescribed) {
    return `STUDENT (context only — NOT constraints on the requested food)
${userContextText(c.user)}

DAY: ${c.dayName}
Daily targets (for later comparison only): ${c.targetCalories} kcal, ${c.targetProtein} g protein.
Other meals that day: ${
      c.otherMeals.length
        ? c.otherMeals.map((m) => `${m.meal_name} (${m.calories ?? "?"} kcal)`).join("; ")
        : "none"
    }

MEAL SLOT BEING REPLACED
- ${c.original.meal_name} (${c.original.meal_type ?? "meal"}) at ${c.original.scheduled_time ?? "flexible"}
- Its previous values (${c.original.calories ?? 0} kcal, ${c.original.protein ?? 0} g protein) are NOT a budget to respect.`;
  }
  return mealContextTextFit(c);
}

function mealContextTextFit(c: MealContext) {
  return `STUDENT
${userContextText(c.user)}

DAY: ${c.dayName}
Daily targets: ${c.targetCalories} kcal, ${c.targetProtein} g protein.
Other meals that day: ${
    c.otherMeals.length
      ? c.otherMeals.map((m) => `${m.meal_name} (${m.calories ?? "?"} kcal)`).join("; ")
      : "none"
  }

MEAL BEING REPLACED
- ${c.original.meal_name} (${c.original.meal_type ?? "meal"}) at ${c.original.scheduled_time ?? "flexible"}
- Budget to respect: ${c.original.calories ?? 0} kcal, ${c.original.protein ?? 0} g protein, ${c.original.carbohydrates ?? 0} g carbs, ${c.original.fats ?? 0} g fat

RULES
- Keep the same nutritional role: stay within roughly ±15% of that calorie budget and keep protein close.
- Respect the meal preference and keep ingredients realistic and affordable for a university student.
- preparation_steps: 2 to 6 concise ordered steps using ONLY that meal's ingredients.
- image_prompt: food only, no people, no brands, no text or logos.
- Do NOT include meal_order, scheduled_time or any ids: those are inherited.`;
}

export function buildMealSuggestionsPrompt(c: MealContext) {
  return `You are a university student nutrition coach. Propose EXACTLY 3 alternative meals to replace one meal.

${mealContextText(c)}

DIVERSITY (important)
The 3 options must be meaningfully different from each other and from the original: different cuisine, different main protein/source, and different meal format (e.g. bowl vs sandwich vs cooked plate). Make at least one option quick and simple (under 10 minutes, minimal cooking).

OUTPUT
Return JSON only, exactly:
{ "suggestions": [ ${MEAL_JSON_SHAPE}, ${MEAL_JSON_SHAPE}, ${MEAL_JSON_SHAPE} ] }`;
}

export function buildSpecificMealPrompt(
  c: MealContext,
  request: string,
  mode: SpecificMealMode = "fit_plan",
) {
  if (mode === "as_described") {
    return `You are a nutrition estimator. The student is telling you what they want to eat (or already ate). Your job is to ESTIMATE that exact food, not to improve it.

${mealContextText(c, true)}

STUDENT DESCRIPTION: "${request}"

HOW TO RESPOND
- The description is the source of truth. Reproduce the food EXACTLY as described.
- Do NOT substitute, lighten, shrink or "healthify" anything to satisfy their meal preference, goal, calorie target or macro split. No lettuce wraps, no low-carb buns, no removed sides, no leaner swaps — unless the student explicitly wrote them.
- If the description is broad (e.g. "hamburger"), assume a conventional, typical restaurant/homemade version — never a fitness or low-carb version.
- Estimate realistic calories, protein, carbohydrates and fats for that food and portion. The result MAY be far above or below the daily targets; that is expected and correct.
- ingredients and preparation_steps must describe the food as described (conventional preparation).
- Set "notes" to a short honest estimate caveat, e.g. "Estimated nutrition — add portion details for a closer estimate."
- Set "fit_note" to null. Set "short_description" to a plain one-line description of the dish.
- Only use status "unavailable" if the text is not a food at all or is unsafe; then explain kindly in "message".

OUTPUT
Return JSON only, exactly:
{ "status": "ok" | "unavailable", "message": null, "meal": ${MEAL_JSON_SHAPE} }`;
  }

  return `You are a university student nutrition coach. The student wants a SPECIFIC dish for one meal.

${mealContextText(c)}

STUDENT REQUEST: "${request}"

HOW TO RESPOND
- Do your best to create a realistic version of exactly what they asked for, portioned and prepared so it fits the calorie/macro role above. Adapt portions, cooking method or sides rather than refusing.
- Never reject a normal food just because it is not a stereotypical "fitness" food.
- Use "fit_note" to explain briefly how you adapted it (portion size, leaner cut, less oil, added protein...).
- Only use status "unavailable" when the request is not a food at all, is unsafe, or genuinely cannot be made to fit even loosely; then explain kindly in "message".

OUTPUT
Return JSON only, exactly:
{ "status": "ok" | "unavailable", "message": null, "meal": ${MEAL_JSON_SHAPE} }`;
}

export type BalanceContext = {
  user: UserContext;
  dayName: string;
  targetCalories: number;
  targetProtein: number;
  currentCalories: number;
  currentProtein: number;
  locked: {
    meal_order: number;
    meal_name: string;
    calories: number | null;
    protein: number | null;
    carbohydrates: number | null;
    fats: number | null;
  };
  editable: {
    meal_order: number;
    meal_name: string;
    meal_type: string | null;
    scheduled_time: string | null;
    calories: number | null;
    protein: number | null;
    carbohydrates: number | null;
    fats: number | null;
    ingredients: string[];
  }[];
};

export function buildBalanceDayPrompt(c: BalanceContext) {
  return `You are a university student nutrition coach. Rebalance ONE day so the daily totals move back towards target.

STUDENT
${userContextText(c.user)}

DAY: ${c.dayName}
Daily target: ${c.targetCalories} kcal, ${c.targetProtein} g protein.
Current day totals after the student's own meal choice: ${c.currentCalories} kcal, ${c.currentProtein} g protein.

LOCKED MEAL (the student chose this — it is immutable, do NOT return it, do NOT change it)
- order ${c.locked.meal_order}: ${c.locked.meal_name} — ${c.locked.calories ?? 0} kcal, ${c.locked.protein ?? 0} g protein, ${c.locked.carbohydrates ?? 0} g carbs, ${c.locked.fats ?? 0} g fat

MEALS YOU MAY ADJUST
${c.editable
  .map(
    (m) =>
      `- order ${m.meal_order}: ${m.meal_name} (${m.meal_type ?? "meal"} at ${m.scheduled_time ?? "flexible"}) — ${m.calories ?? 0} kcal, ${m.protein ?? 0} p, ${m.carbohydrates ?? 0} c, ${m.fats ?? 0} f | ingredients: ${m.ingredients.join(", ") || "n/a"}`,
  )
  .join("\n")}

RULES
- Return EXACTLY one entry for every adjustable meal above, with the SAME meal_order values: ${c.editable.map((m) => m.meal_order).join(", ")}.
- Prefer portion / ingredient-quantity adjustments and modest recipe tweaks. Only rename or change a dish when quantity changes cannot get close enough.
- When a meal stays essentially the same dish, keep its meal_name, ingredients wording and image_prompt unchanged so its photo stays valid.
- After your changes, the locked meal plus your meals must total close to ${c.targetCalories} kcal (within 5%) and near ${c.targetProtein} g protein.
- preparation_steps must match the adjusted quantities.

OUTPUT
Return JSON only, exactly:
{ "meals": [ { "meal_order": 1, "meal_name": "", "calories": 0, "protein": 0, "carbohydrates": 0, "fats": 0, "ingredients": ["..."], "preparation_steps": ["...","..."], "image_prompt": "", "notes": "" } ] }`;
}

/* -------------------------------------------------------------- exercises */

export type ExerciseContext = {
  user: UserContext;
  workoutTitle: string | null;
  workoutType: string | null;
  durationMinutes: number | null;
  original: {
    exercise_name: string;
    exercise_slug: string | null;
    sets: number | null;
    reps: string | null;
    duration_seconds: number | null;
    rest_seconds: number | null;
    family: string | null;
    muscle: string | null;
  };
  otherExercises: string[];
};

const EX_JSON = `{ "exercise_slug": "", "sets": 3, "reps": "10-12", "duration_seconds": null, "rest_seconds": 60, "notes": "", "rationale": "" }`;

function exerciseContextText(c: ExerciseContext, pool: Candidate[]) {
  return `STUDENT
${userContextText(c.user)}

WORKOUT: ${c.workoutTitle ?? "session"} (${c.workoutType ?? "training"}), ${c.durationMinutes ?? "?"} minutes total.
Other exercises already in this workout (do NOT duplicate them): ${c.otherExercises.join(", ") || "none"}

EXERCISE BEING REPLACED
- ${c.original.exercise_name} (slug ${c.original.exercise_slug ?? "unknown"}, family ${c.original.family ?? "unknown"}, muscle ${c.original.muscle ?? "unknown"})
- Current prescription: ${c.original.sets ?? "?"} sets, ${c.original.reps ?? `${c.original.duration_seconds ?? "?"}s`}, rest ${c.original.rest_seconds ?? "?"}s

CATALOGUE (choose exercise_slug ONLY from this list, copied EXACTLY)
slug | name | muscle | equipment | difficulty | family
${pool.map((p) => `${p.slug} | ${p.name} | ${p.muscle} | ${p.equipment} | ${p.difficulty} | ${p.family}`).join("\n")}`;
}

export function buildExerciseSuggestionsPrompt(c: ExerciseContext, pool: Candidate[]) {
  return `You are a strength coach. Propose EXACTLY 3 replacement exercises for one exercise inside an existing workout.

${exerciseContextText(c, pool)}

RULES
- Keep the training role: same movement family or a compatible one, hitting the same primary muscle.
- The 3 options must be different from each other and from the exercise being replaced.
- Keep the workout's approximate duration: sets, reps/duration and rest must be similar in total time to the current prescription.
- Give either "reps" or "duration_seconds" (duration for holds/cardio), never neither.
- "rationale": one short line explaining why this is a good swap.

OUTPUT
Return JSON only, exactly:
{ "suggestions": [ ${EX_JSON}, ${EX_JSON}, ${EX_JSON} ] }`;
}

export function buildSpecificExercisePrompt(
  c: ExerciseContext,
  pool: Candidate[],
  request: string,
  contextLabel: string,
  compatibleSlugs: string[],
) {
  return `You are a strength coach. The student asked for a SPECIFIC exercise to replace one exercise.

${exerciseContextText(c, pool)}

TRAINING CONTEXT: ${contextLabel}
SLUGS THAT FIT THAT CONTEXT: ${compatibleSlugs.join(", ") || "none"}

STUDENT REQUEST: "${request}"

HOW TO RESPOND
- First find the catalogue entry that IS the requested exercise (or its closest exact naming variant). Search the whole catalogue above, not only the context-compatible slugs.
- status "ok": the requested exercise exists AND its slug is in the context-compatible list. Return that exact slug with a sensible prescription.
- status "incompatible": the requested exercise exists in the catalogue but its slug is NOT context-compatible (for example gym equipment while training at home). Return that exact slug anyway and explain in "message" which equipment/context it needs. Never substitute a different exercise.
- status "not_found": no catalogue entry reasonably matches the request. exercise_slug must be null and "message" must explain kindly.
- NEVER return a slug that is not in the catalogue above.

OUTPUT
Return JSON only, exactly:
{ "status": "ok" | "incompatible" | "not_found", "exercise_slug": null, "message": null, "sets": 3, "reps": "10-12", "duration_seconds": null, "rest_seconds": 60, "notes": "", "rationale": "" }`;
}
