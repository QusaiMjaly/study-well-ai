import { z } from "zod";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const SlotSchema = z.object({
  start_time: z.string().regex(TIME),
  end_time: z.string().regex(TIME),
});

const ClassSchema = z.object({
  course_name: z.string().min(1),
  start_time: z.string().regex(TIME),
  end_time: z.string().regex(TIME),
  location: z.string().nullable().optional().transform((v) => v ?? null),
});

export const ScheduleJsonSchema = z.object({
  timezone: z.string().min(1).default("Asia/Jerusalem"),
  days: z.array(
    z.object({
      day: z.enum(DAYS),
      classes: z.array(ClassSchema).default([]),
      free_slots: z.array(SlotSchema).default([]),
    }),
  ),
  warnings: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ScheduleJson = z.infer<typeof ScheduleJsonSchema>;
export type ScheduleClass = z.infer<typeof ClassSchema>;

const DAY_START = "08:00";
const DAY_END = "22:00";

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Drops invalid/overlapping classes, sorts by start time and recomputes free slots. */
export function normalizeSchedule(input: ScheduleJson): ScheduleJson {
  const warnings = [...input.warnings];

  const days = DAYS.map((day) => {
    const source = input.days.find((d) => d.day === day);
    const sorted = (source?.classes ?? [])
      .filter((c) => {
        if (toMin(c.end_time) > toMin(c.start_time)) return true;
        warnings.push(`Ignored "${c.course_name}" on ${day}: invalid time range.`);
        return false;
      })
      .sort((a, b) => toMin(a.start_time) - toMin(b.start_time));

    const classes: ScheduleClass[] = [];
    for (const c of sorted) {
      const prev = classes[classes.length - 1];
      if (prev && toMin(c.start_time) < toMin(prev.end_time)) {
        warnings.push(`Ignored "${c.course_name}" on ${day}: overlaps "${prev.course_name}".`);
        continue;
      }
      classes.push(c);
    }

    const free_slots: { start_time: string; end_time: string }[] = [];
    let cursor = toMin(DAY_START);
    for (const c of classes) {
      const start = Math.max(toMin(c.start_time), toMin(DAY_START));
      if (start - cursor >= 30) free_slots.push({ start_time: toHHmm(cursor), end_time: toHHmm(start) });
      cursor = Math.max(cursor, Math.min(toMin(c.end_time), toMin(DAY_END)));
    }
    if (toMin(DAY_END) - cursor >= 30)
      free_slots.push({ start_time: toHHmm(cursor), end_time: DAY_END });

    return { day, classes, free_slots };
  });

  return {
    timezone: input.timezone || "Asia/Jerusalem",
    days,
    warnings,
    confidence: input.confidence,
  };
}
