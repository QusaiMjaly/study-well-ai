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

export type DayKey = (typeof DAYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
};

/**
 * Types accepted from persisted schedules. "busy" is the legacy value that
 * older saved schedules used; it is read as "other" everywhere in the UI.
 */
export const STORED_BLOCK_TYPES = ["study", "work", "other", "busy"] as const;
export type StoredBlockType = (typeof STORED_BLOCK_TYPES)[number];

/** Types the editor offers and writes. */
export const BLOCK_TYPES = ["study", "work", "other"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  study: "Study",
  work: "Work",
  other: "Other",
};

const SlotSchema = z.object({
  start_time: z.string().regex(TIME),
  end_time: z.string().regex(TIME),
});

/**
 * A single unavailable block.
 *
 * Backwards compatibility: this is the same object older schedules stored in
 * `classes`, so `course_name` stays the label field and a missing `type`
 * normalises to "study" (every legacy entry was a class).
 */
const ClassSchema = z.object({
  course_name: z.string().min(1),
  start_time: z.string().regex(TIME),
  end_time: z.string().regex(TIME),
  location: z.string().nullable().optional().transform((v) => v ?? null),
  type: z.enum(STORED_BLOCK_TYPES).optional().default("study"),
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

/** Editor-facing flat block used by the manual weekly schedule UI. */
export type ScheduleBlock = {
  id: string;
  day: DayKey;
  start_time: string;
  end_time: string;
  type: BlockType;
  label: string | null;
};

const DAY_START = "08:00";
const DAY_END = "22:00";

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Normalises a persisted block type into the current UI vocabulary. */
// הפונקציה ממירה סוג בלוק שמור לסוג שהממשק מכיר (busy ישן הופך ל-Other)
export function blockTypeOf(c: { type?: StoredBlockType | string | null }): BlockType {
  if (c.type === "work") return "work";
  // Legacy "busy" blocks stay valid and simply read as "Other".
  if (c.type === "other" || c.type === "busy") return "other";
  return "study";
}

/** Drops invalid/overlapping blocks, sorts by start time and recomputes free slots. */
// הפונקציה מסדרת את הלו"ז: מסירה בלוקים לא תקינים או חופפים, ממיינת לפי שעה ומחשבת חלונות פנויים
export function normalizeSchedule(input: ScheduleJson): ScheduleJson {
  const warnings = [...input.warnings];

  const days = DAYS.map((day) => {
    const source = input.days.find((d) => d.day === day);
    const sorted = (source?.classes ?? [])
      .map((c) => ({ ...c, type: blockTypeOf(c) }))
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

    // Both study and busy blocks mean the student is unavailable.
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

/* ------------------------------------------------------------------ */
/* Editor <-> canonical JSON                                           */
/* ------------------------------------------------------------------ */

let seq = 0;
// הפונקציה יוצרת מזהה ייחודי לבלוק חדש בעורך הלו"ז
export function newBlockId() {
  seq += 1;
  return `b${Date.now().toString(36)}${seq}`;
}

/** Flattens a stored schedule into editable blocks (legacy classes become STUDY). */
// הפונקציה הופכת לו"ז שמור לרשימת בלוקים שהעורך יכול להציג ולערוך
export function scheduleToBlocks(schedule: ScheduleJson | null | undefined): ScheduleBlock[] {
  if (!schedule) return [];
  const blocks: ScheduleBlock[] = [];
  for (const d of schedule.days ?? []) {
    for (const c of d.classes ?? []) {
      blocks.push({
        id: newBlockId(),
        day: d.day,
        start_time: c.start_time,
        end_time: c.end_time,
        type: blockTypeOf(c),
        label:
          c.course_name && !["Busy", "Class", "Work", "Other"].includes(c.course_name)
            ? c.course_name
            : null,
      });
    }
  }
  return blocks;
}

// הפונקציה הופכת את הבלוקים מהעורך חזרה למבנה הלו"ז הרשמי לשמירה
export function blocksToSchedule(blocks: ScheduleBlock[], timezone = "Asia/Jerusalem"): ScheduleJson {
  return normalizeSchedule({
    timezone,
    days: DAYS.map((day) => ({
      day,
      classes: blocks
        .filter((b) => b.day === day)
        .map((b) => ({
          course_name:
            (b.label ?? "").trim() ||
            (b.type === "study" ? "Class" : BLOCK_TYPE_LABELS[b.type]),
          start_time: b.start_time,
          end_time: b.end_time,
          location: null,
          type: b.type,
        })),
      free_slots: [],
    })),
    warnings: [],
    confidence: 1,
  });
}

/** Field-level validation for a single block; returns a friendly error or null. */
// הפונקציה בודקת שבלוק בודד תקין (יום, שעות, סוג) ומחזירה הודעת שגיאה ידידותית או null
export function validateBlock(b: {
  day: string;
  start_time: string;
  end_time: string;
  type: string;
}): string | null {
  if (!DAYS.includes(b.day as DayKey)) return "Choose a valid day.";
  if (!TIME.test(b.start_time) || !TIME.test(b.end_time)) return "Times must be in HH:mm format.";
  if (toMin(b.end_time) <= toMin(b.start_time)) return "End time must be after the start time.";
  if (toMin(b.end_time) - toMin(b.start_time) > 12 * 60)
    return "A single block can't be longer than 12 hours.";
  if (!BLOCK_TYPES.includes(b.type as BlockType)) return "Choose Study, Work or Other.";
  return null;
}

/** Ids of blocks that overlap another block on the same day. */
// הפונקציה מוצאת בלוקים שחופפים זמנית באותו יום כדי לסמן אותם כבעייתיים
export function overlappingBlockIds(blocks: ScheduleBlock[]): Set<string> {
  const bad = new Set<string>();
  for (const day of DAYS) {
    const list = blocks
      .filter((b) => b.day === day)
      .sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (toMin(cur.start_time) < toMin(prev.end_time)) {
        bad.add(prev.id);
        bad.add(cur.id);
      }
    }
  }
  return bad;
}

export const isDuplicateBlock = (a: ScheduleBlock, b: ScheduleBlock) =>
  a.day === b.day && a.start_time === b.start_time && a.end_time === b.end_time && a.type === b.type;

/** Adds imported blocks to existing ones, skipping exact duplicates. */
// הפונקציה ממזגת בלוקים שיובאו מתמונה לתוך הבלוקים הקיימים, בלי כפילויות
export function mergeImportedBlocks(existing: ScheduleBlock[], imported: ScheduleBlock[]) {
  const added: ScheduleBlock[] = [];
  for (const inc of imported) {
    if (existing.some((e) => isDuplicateBlock(e, inc)) || added.some((e) => isDuplicateBlock(e, inc)))
      continue;
    added.push(inc);
  }
  return { blocks: [...existing, ...added], addedCount: added.length, skipped: imported.length - added.length };
}
