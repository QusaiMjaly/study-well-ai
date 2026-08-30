import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  diffPlanFields,
  num,
  snapshotFrom,
  validateEdits,
  type PlanAffectingField,
  type ProfileEdits,
} from "./profile-fields";

/**
 * Saves the signed-in user's profile + goals and reports whether any field that
 * AI plan generation actually reads changed. Goals are written append-only so
 * the newest row's created_at is a reliable "inputs changed at" signal.
 */
export const saveProfileDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const edits = d as ProfileEdits;
    const message = validateEdits(edits);
    if (message) throw new Error(message);
    return edits;
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ changed: boolean; changedFields: PlanAffectingField[] }> => {
      const { supabase, userId } = context;

      const [{ data: profile }, { data: goals }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const previous = snapshotFrom({ ...(profile ?? {}), ...(goals ?? {}) });

      const profilePayload = {
        id: userId,
        email: profile?.email ?? null,
        full_name: data.full_name.trim(),
        age: num(data.age),
        gender: data.gender || null,
        height: num(data.height),
        weight: num(data.weight),
        activity_level: data.activity_level || null,
      };

      const { error: pErr } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });
      if (pErr) throw new Error(pErr.message);

      const goalPayload = {
        user_id: userId,
        goal_type: data.goal_type || null,
        target_weight: num(data.target_weight),
        workout_preference: data.workout_preference || null,
        meal_preference: data.meal_preference || null,
        workout_duration: data.workout_duration || null,
        preferred_time: data.preferred_time || null,
        biggest_challenge: data.biggest_challenge.trim() || null,
        workout_days: goals?.workout_days ?? null,
      };

      const { error: gErr } = await supabase.from("goals").insert(goalPayload);
      if (gErr) throw new Error(gErr.message);

      const next = snapshotFrom({ ...profilePayload, ...goalPayload });
      const changedFields = diffPlanFields(previous, next);

      return { changed: changedFields.length > 0, changedFields };
    },
  );
