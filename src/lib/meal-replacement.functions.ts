import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildBalanceDayPrompt,
  buildMealSuggestionsPrompt,
  buildSpecificMealPrompt,
  callStructuredJson,
} from "./replacement-prompt";
import {
  BalanceDaySchema,
  ISO_DATE,
  MealReplacementSchema,
  MealSuggestionsSchema,
  SpecificMealSchema,
  type MealReplacement,
} from "./replacement-schema";
import {
  balancedMealUpdate,
  dayTargets,
  imageStillValid,
  loadMeal,
  loadUserContext,
  recomputeDayTotals,
  shouldOfferBalance,
  sumMeals,
  type DayTotals,
} from "./replacement-core";

const Target = z.object({
  mealItemId: z.string().uuid(),
  planId: z.string().uuid(),
});

export type MealApplyResult =
  | { status: "needs_confirmation" }
  | {
      status: "applied";
      mealItemId: string;
      mealDayId: string;
      totals: DayTotals;
      targets: { calories: number; protein: number };
      offerBalance: boolean;
    };

export const suggestMealReplacements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Target.parse(d))
  .handler(async ({ data, context }): Promise<{ suggestions: MealReplacement[] }> => {
    const { supabase, userId } = context;
    const { meal, day, dayMeals } = await loadMeal(supabase, data.mealItemId, data.planId);
    const user = await loadUserContext(supabase, userId);
    const targets = await dayTargets(supabase, data.planId, day.id, {
      calories: Number(day.total_calories ?? 0),
      protein: Number(day.protein ?? 0),
    });

    const raw = await callStructuredJson(
      buildMealSuggestionsPrompt({
        user,
        dayName: day.day_name,
        targetCalories: targets.calories,
        targetProtein: targets.protein,
        original: meal,
        otherMeals: dayMeals
          .filter((m) => m.id !== meal.id)
          .map((m) => ({ meal_name: m.meal_name, calories: m.calories })),
      }),
    );

    const parsed = MealSuggestionsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("The AI suggestions were incomplete. Please try again.");
    }
    return { suggestions: parsed.data.suggestions };
  });

export const requestSpecificMealReplacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    Target.extend({ request: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ status: "ok" | "unavailable"; meal: MealReplacement | null; message: string | null }> => {
      const { supabase, userId } = context;
      const { meal, day, dayMeals } = await loadMeal(supabase, data.mealItemId, data.planId);
      const user = await loadUserContext(supabase, userId);
      const targets = await dayTargets(supabase, data.planId, day.id, {
        calories: Number(day.total_calories ?? 0),
        protein: Number(day.protein ?? 0),
      });

      const raw = await callStructuredJson(
        buildSpecificMealPrompt(
          {
            user,
            dayName: day.day_name,
            targetCalories: targets.calories,
            targetProtein: targets.protein,
            original: meal,
            otherMeals: dayMeals
              .filter((m) => m.id !== meal.id)
              .map((m) => ({ meal_name: m.meal_name, calories: m.calories })),
          },
          data.request,
        ),
      );

      const parsed = SpecificMealSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          status: "unavailable",
          meal: null,
          message: "We couldn't build that meal right now. Please try again.",
        };
      }
      if (parsed.data.status !== "ok" || !parsed.data.meal) {
        return {
          status: "unavailable",
          meal: null,
          message:
            parsed.data.message ?? "That request doesn't fit this meal. Try describing it differently.",
        };
      }
      return { status: "ok", meal: parsed.data.meal, message: parsed.data.message };
    },
  );

export const applyMealReplacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    Target.extend({
      expectedMealName: z.string().min(1),
      expectedMealOrder: z.number().int().min(1),
      today: z.string().regex(ISO_DATE),
      confirmCompleted: z.boolean().default(false),
      replacement: MealReplacementSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MealApplyResult> => {
    const { supabase, userId } = context;
    const { meal, day } = await loadMeal(supabase, data.mealItemId, data.planId);

    // Stale-suggestion protection: the item must still be the one we suggested for.
    if (meal.meal_name !== data.expectedMealName || meal.meal_order !== data.expectedMealOrder) {
      throw new Error("Your plan changed. Reopen this item to get fresh suggestions.");
    }

    const { data: completion } = await supabase
      .from("meal_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("meal_item_id", meal.id)
      .eq("completed_on", data.today)
      .maybeSingle();

    if (completion && !data.confirmCompleted) return { status: "needs_confirmation" };

    const r = data.replacement;
    const keepImage = imageStillValid(meal, r);

    const { error: upErr } = await supabase
      .from("meal_items")
      .update({
        meal_name: r.meal_name,
        meal_type: r.meal_type,
        calories: r.calories,
        protein: r.protein,
        carbohydrates: r.carbohydrates,
        fats: r.fats,
        ingredients: r.ingredients,
        preparation_steps: r.preparation_steps,
        image_prompt: r.image_prompt,
        notes: r.notes,
        ...(keepImage ? {} : { image_path: null, image_status: "none" }),
      })
      .eq("id", meal.id);
    if (upErr) throw new Error("The replacement could not be saved. Please try again.");

    const targets = await dayTargets(supabase, data.planId, day.id, {
      calories: Number(day.total_calories ?? 0),
      protein: Number(day.protein ?? 0),
    });
    const totals = await recomputeDayTotals(supabase, day.id);

    return {
      status: "applied",
      mealItemId: meal.id,
      mealDayId: day.id,
      totals,
      targets,
      offerBalance: shouldOfferBalance(totals, targets),
    };
  });

export const balanceMealDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        mealDayId: z.string().uuid(),
        lockedMealItemId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ totals: DayTotals; targets: { calories: number; protein: number } }> => {
      const { supabase, userId } = context;
      const { meal: locked, day, dayMeals } = await loadMeal(
        supabase,
        data.lockedMealItemId,
        data.planId,
      );
      if (day.id !== data.mealDayId) {
        throw new Error("Your plan changed. Reopen this item to get fresh suggestions.");
      }

      const editable = dayMeals.filter((m) => m.id !== locked.id);
      if (!editable.length) {
        throw new Error("There are no other meals to adjust on this day.");
      }

      const user = await loadUserContext(supabase, userId);
      const targets = await dayTargets(supabase, data.planId, day.id, {
        calories: Number(day.total_calories ?? 0),
        protein: Number(day.protein ?? 0),
      });
      const current = sumMeals(dayMeals);

      const raw = await callStructuredJson(
        buildBalanceDayPrompt({
          user,
          dayName: day.day_name,
          targetCalories: targets.calories,
          targetProtein: targets.protein,
          currentCalories: current.calories,
          currentProtein: current.protein,
          locked: {
            meal_order: locked.meal_order,
            meal_name: locked.meal_name,
            calories: locked.calories,
            protein: locked.protein,
            carbohydrates: locked.carbohydrates,
            fats: locked.fats,
          },
          editable: editable.map((m) => ({
            meal_order: m.meal_order,
            meal_name: m.meal_name,
            meal_type: m.meal_type,
            scheduled_time: m.scheduled_time,
            calories: m.calories,
            protein: m.protein,
            carbohydrates: m.carbohydrates,
            fats: m.fats,
            ingredients: m.ingredients ?? [],
          })),
        }),
      );

      const parsed = BalanceDaySchema.safeParse(raw);
      if (!parsed.success) throw new Error("Balancing didn't work this time. Please try again.");

      const expected = editable.map((m) => m.meal_order).sort((a, b) => a - b);
      const got = parsed.data.meals.map((m) => m.meal_order).sort((a, b) => a - b);
      if (
        got.length !== expected.length ||
        got.some((o, i) => o !== expected[i]) ||
        parsed.data.meals.some((m) => m.meal_order === locked.meal_order)
      ) {
        throw new Error("Balancing didn't work this time. Please try again.");
      }

      for (const next of parsed.data.meals) {
        const existing = editable.find((m) => m.meal_order === next.meal_order)!;
        const { error } = await supabase
          .from("meal_items")
          .update(balancedMealUpdate(existing, next))
          .eq("id", existing.id);
        if (error) throw new Error("The balanced day could not be saved. Please try again.");
      }

      const totals = await recomputeDayTotals(supabase, day.id);
      return { totals, targets };
    },
  );
