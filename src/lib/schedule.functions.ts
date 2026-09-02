import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  BLOCK_TYPES,
  DAYS,
  blocksToSchedule,
  newBlockId,
  overlappingBlockIds,
  validateBlock,
  type ScheduleBlock,
} from "./schedule-schema";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3-flash-preview";

const EXTRACTION_PROMPT = `You are a timetable OCR engine. Look at the image and decide whether it is a university/class timetable or schedule.

Return EXACTLY this JSON shape and nothing else (no markdown, no commentary):
{
  "is_timetable": true,
  "timezone": "Asia/Jerusalem",
  "blocks": [
    { "day": "sunday", "start_time": "08:30", "end_time": "10:00", "label": "Algorithms" }
  ],
  "warnings": [],
  "confidence": 0.95
}

Rules:
- If the image is NOT a class timetable/schedule (a selfie, a receipt, random text, etc.), return {"is_timetable": false, "blocks": [], "warnings": ["..."], "confidence": 0}.
- Valid JSON only. Lowercase English day names (sunday..saturday).
- 24-hour HH:mm times. end_time must be after start_time.
- Never invent courses or times you cannot read; add a short explanation to "warnings" instead.
- "label" is the course name and may be null.
- Only extract study/class periods. Sort by start_time. Skip overlapping or unreadable entries and record them in "warnings".
- "confidence" is a number between 0 and 1 reflecting how legible the timetable was.`;

const ImportInput = z.object({ path: z.string().min(1).max(300) });

const AiBlock = z.object({
  day: z.enum(DAYS),
  start_time: z.string(),
  end_time: z.string(),
  label: z.string().nullable().optional(),
});

const AiResult = z.object({
  is_timetable: z.boolean().default(true),
  blocks: z.array(AiBlock).default([]),
  warnings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ImportedTimetable = {
  isTimetable: boolean;
  blocks: ScheduleBlock[];
  warnings: string[];
  confidence: number;
};

/**
 * Reads a freshly uploaded timetable image and returns STUDY blocks for review.
 * It never writes to the schedules table — saving is an explicit user action.
 */
export const importTimetableImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImportInput.parse(d))
  .handler(async ({ data, context }): Promise<ImportedTimetable> => {
    const { supabase, userId } = context;

    // Ownership: storage paths are always namespaced by the owner's user id.
    if (!data.path.startsWith(`${userId}/`)) throw new Error("That image doesn't belong to you.");

    const { data: file, error: dlErr } = await supabase.storage
      .from("schedule-images")
      .download(data.path);
    if (dlErr || !file) throw new Error("Could not read your timetable image. Please re-upload it.");

    const mime = file.type || "image/png";
    if (!mime.startsWith("image/")) throw new Error("That file isn't an image. Please upload a PNG or JPG.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;

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

    const result = AiResult.safeParse(parsed);
    if (!result.success) {
      return {
        isTimetable: false,
        blocks: [],
        warnings: [],
        confidence: 0,
      };
    }

    const blocks: ScheduleBlock[] = result.data.blocks
      .filter((b) => !validateBlock({ ...b, type: "study" }))
      .map((b) => ({
        id: newBlockId(),
        day: b.day,
        start_time: b.start_time,
        end_time: b.end_time,
        type: "study" as const,
        label: (b.label ?? "").trim() || null,
      }));

    return {
      isTimetable: result.data.is_timetable && blocks.length > 0,
      blocks,
      warnings: result.data.warnings,
      confidence: result.data.confidence,
    };
  });

const SaveInput = z.object({
  blocks: z
    .array(
      z.object({
        day: z.enum(DAYS),
        start_time: z.string(),
        end_time: z.string(),
        type: z.enum(BLOCK_TYPES),
        label: z.string().max(80).nullable().optional(),
      }),
    )
    .min(1)
    .max(120),
  imagePath: z.string().max(300).nullable().optional(),
});

/** Validates the reviewed weekly schedule and stores it as the current schedule. */
export const saveSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }): Promise<{ scheduleId: string }> => {
    const { supabase, userId } = context;

    const blocks: ScheduleBlock[] = data.blocks.map((b) => ({
      id: newBlockId(),
      day: b.day,
      start_time: b.start_time,
      end_time: b.end_time,
      type: b.type,
      label: (b.label ?? "").trim() || null,
    }));

    for (const b of blocks) {
      const err = validateBlock(b);
      if (err) throw new Error(err);
    }
    if (overlappingBlockIds(blocks).size > 0)
      throw new Error("Some blocks overlap. Fix the overlaps before saving.");

    if (data.imagePath && !data.imagePath.startsWith(`${userId}/`))
      throw new Error("That image doesn't belong to you.");

    const schedule = blocksToSchedule(blocks);

    const { data: inserted, error } = await supabase
      .from("schedules")
      .insert({
        user_id: userId,
        image_url: data.imagePath ?? null,
        schedule_json: schedule as unknown as never,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not save your schedule: ${error.message}`);

    return { scheduleId: inserted.id };
  });
