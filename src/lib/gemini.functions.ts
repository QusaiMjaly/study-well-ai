import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
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
      supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("schedules").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
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

    const [mealText, workoutText] = await Promise.all([callGemini(mealPrompt), callGemini(workoutPrompt)]);
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
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");

    // Fetch image and convert to base64
    const imgRes = await fetch(data.imageUrl);
    if (!imgRes.ok) throw new Error("Could not fetch schedule image");
    const buf = await imgRes.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const mime = imgRes.headers.get("content-type") || "image/jpeg";

    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Extract this class schedule into JSON: { "days": [ { "day": "Monday", "classes": [{"name":"...","start":"09:00","end":"10:30","location":"..."}] }, ... ] }. Return JSON only.',
              },
              { inline_data: { mime_type: mime, data: b64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw new Error(`Gemini vision error: ${res.status}`);
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = safeParse(text, { days: [] });

    await context.supabase
      .from("schedules")
      .update({ schedule_json: parsed })
      .eq("user_id", context.userId)
      .eq("image_url", data.imageUrl);

    return parsed;
  });
