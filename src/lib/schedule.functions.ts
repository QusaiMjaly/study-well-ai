import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ScheduleJsonSchema, normalizeSchedule, type ScheduleJson } from "./schedule-schema";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3-flash-preview";

const EXTRACTION_PROMPT = `You are a timetable OCR engine. Extract the university class timetable in the image into strict JSON.

Return EXACTLY this shape and nothing else (no markdown, no commentary):
{
  "timezone": "Asia/Jerusalem",
  "days": [
    { "day": "sunday", "classes": [ { "course_name": "Algorithms", "start_time": "08:30", "end_time": "10:00", "location": "Room 201" } ], "free_slots": [] }
  ],
  "warnings": [],
  "confidence": 0.95
}

Rules:
- Valid JSON only. Lowercase English day names (sunday..saturday).
- 24-hour HH:mm times. end_time must be after start_time.
- Never invent courses or times you cannot read; instead add a short explanation to "warnings".
- "location" may be null. "classes" may be an empty array. Leave "free_slots" empty; it is computed later.
- Sort classes by start_time. Skip overlapping or invalid entries and record them in "warnings".
- "confidence" is a number between 0 and 1 reflecting how legible the timetable was.`;

export const analyzeTimetable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ schedule: ScheduleJson; scheduleId: string }> => {
    const { supabase, userId } = context;

    const { data: row, error: rowErr } = await supabase
      .from("schedules")
      .select("id, image_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rowErr) throw new Error(`Could not load your schedule record: ${rowErr.message}`);
    if (!row || !row.image_url) throw new Error("No timetable image found. Go back and upload your timetable.");

    const { data: file, error: dlErr } = await supabase.storage
      .from("schedule-images")
      .download(row.image_url);
    if (dlErr || !file) throw new Error("Could not read your timetable image from storage. Please re-upload it.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const dataUrl = `data:${file.type || "image/png"};base64,${btoa(binary)}`;

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured on the server.");

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
    } catch {
      throw new Error("The AI response was not valid JSON. Please retry.");
    }

    const result = ScheduleJsonSchema.safeParse(parsed);
    if (!result.success) throw new Error("The timetable could not be read reliably. Please retry with a clearer image.");

    const schedule = normalizeSchedule(result.data);
    const hasClasses = schedule.days.some((d) => d.classes.length > 0);
    if (!hasClasses) throw new Error("No classes could be read from that timetable image. Try a clearer photo.");

    const { error: updErr } = await supabase
      .from("schedules")
      .update({ schedule_json: schedule })
      .eq("id", row.id)
      .eq("user_id", userId);
    if (updErr) throw new Error(`Could not save your schedule: ${updErr.message}`);

    return { schedule, scheduleId: row.id };
  });
