import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_MODEL = "google/gemini-3-flash-preview";
const VISION_MODEL = "google/gemini-3-flash-preview";

async function callGatewayJSON(
  messages: Array<{ role: string; content: unknown }>,
  model = TEXT_MODEL,
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please wait a moment and try again.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to your Lovable workspace.");
    throw new Error(`AI gateway error: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "{}";
}

function safeParse<T>(text: string, fallback: T): T {
  try {
    const clean = text.replace(/^```json\s*|\s*```$/g, "").trim();
    return JSON.parse(clean) as T;
  } catch {
    return fallback;
  }
}

export const generatePlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as Record<string, never>)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: goal }, { data: schedule }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("schedules").select("*").eq("user_id", userId).not("schedule_json", "is", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const ctx = {
      profile,
      goal,
      schedule_summary: schedule?.schedule_json ?? "No schedule uploaded",
    };

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const mealPrompt = `You are a nutritionist for university students. Based on this user data: ${JSON.stringify(
      ctx,
    )}, create a 7-day meal plan. Return JSON: { "days": [ { "day": "Monday", "breakfast": "...", "lunch": "...", "dinner": "...", "snacks": "...", "calories": 2000 }, ... ] }. Include all 7 days: ${days.join(", ")}.`;

    const workoutPrompt = `You are a fitness coach for university students. Based on this user data: ${JSON.stringify(
      ctx,
    )}, create a 7-day workout plan that fits around their class schedule. Return JSON: { "days": [ { "day": "Monday", "focus": "...", "duration_minutes": 30, "exercises": [{"name":"...","sets":3,"reps":"10-12"}], "notes": "..." }, ... ] }. Include all 7 days. Use rest days appropriately.`;

    const [mealText, workoutText] = await Promise.all([
      callGatewayJSON([{ role: "user", content: mealPrompt }]),
      callGatewayJSON([{ role: "user", content: workoutPrompt }]),
    ]);
    const mealPlan = safeParse(mealText, { days: [] });
    const workoutPlan = safeParse(workoutText, { days: [] });

    await Promise.all([
      supabase.from("meal_plans").insert({ user_id: userId, plan: mealPlan }),
      supabase.from("workout_plans").insert({ user_id: userId, plan: workoutPlan }),
    ]);

    return { mealPlan, workoutPlan };
  });

const ParseScheduleInput = z.object({ imageUrl: z.string().url() });

export const parseSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ParseScheduleInput.parse(d))
  .handler(async ({ data, context }) => {
    const text = await callGatewayJSON(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Extract this class schedule into JSON: { "days": [ { "day": "Monday", "classes": [{"name":"...","start":"09:00","end":"10:30","location":"..."}] }, ... ] }. Return JSON only.',
            },
            { type: "image_url", image_url: { url: data.imageUrl } },
          ],
        },
      ],
      VISION_MODEL,
    );
    const parsed = safeParse(text, { days: [] });

    await context.supabase
      .from("schedules")
      .update({ schedule_json: parsed })
      .eq("user_id", context.userId)
      .eq("image_url", data.imageUrl);

    return parsed;
  });
