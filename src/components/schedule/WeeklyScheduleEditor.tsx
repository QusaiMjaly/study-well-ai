import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Blocks,
  BookOpen,
  Briefcase,
  Clock,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { friendlyMessage } from "@/lib/friendly-errors";
import { uploadTimetableImage } from "@/lib/schedule-upload";
import { importTimetableImage } from "@/lib/schedule.functions";
import {
  BLOCK_TYPE_LABELS,
  DAYS,
  DAY_LABELS,
  ALL_DAY_END,
  ALL_DAY_START,
  mergeImportedBlocks,
  newBlockId,
  overlappingBlockIds,
  toMin,
  validateBlock,
  type BlockType,
  type DayKey,
  type ScheduleBlock,
} from "@/lib/schedule-schema";

type Props = {
  blocks: ScheduleBlock[];
  onChange: (blocks: ScheduleBlock[]) => void;
  /** Storage path of the most recently imported image, if any. */
  onImageImported?: (path: string) => void;
  /**
   * "managed" (default): read-only timetable with an "Edit schedule" action.
   * "always": the timetable is permanently editable (used during onboarding).
   */
  mode?: "managed" | "always";
  /** Called when the user presses "Save changes" in managed mode. */
  onSave?: (blocks: ScheduleBlock[]) => Promise<void> | void;
  saving?: boolean;
};

const DAY_SHORT: Record<DayKey, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const TYPE_ICON: Record<BlockType, typeof BookOpen> = {
  study: BookOpen,
  work: Briefcase,
  other: Blocks,
};

type Draft = {
  id: string;
  days: DayKey[];
  start_time: string;
  end_time: string;
  type: BlockType;
  label: string | null;
};

// הפונקציה בודקת אם הטיוטה מוגדרת כיום שלם (עסוק כל היום)
const isAllDay = (d: Draft) => d.start_time === ALL_DAY_START && d.end_time === ALL_DAY_END;

const emptyDraft = (days: DayKey[]): Draft => ({
  id: "",
  days,
  start_time: "10:00",
  end_time: "12:00",
  type: "study",
  label: null,
});

// הקומפוננטה היא עורך מערכת השעות השבועית: תצוגה, עריכה, בחירת ימים מרובה, הוספת בלוקים וייבוא מתמונה
export function WeeklyScheduleEditor({
  blocks,
  onChange,
  onImageImported,
  mode = "managed",
  onSave,
  saving = false,
}: Props) {
  const always = mode === "always";
  const [editing, setEditing] = useState(always);
  /** Local draft of the whole schedule while editing (managed mode). */
  const [work, setWork] = useState<ScheduleBlock[]>(blocks);
  const [activeDay, setActiveDay] = useState<DayKey>(DAYS[new Date().getDay()]!);
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Times to restore when "Busy all day" is switched back off. */
  const prevTimes = useRef({ start_time: "10:00", end_time: "12:00" });

  const runImport = useServerFn(importTimetableImage);

  // Keep the local draft in sync with persisted data while not editing.
  useEffect(() => {
    if (always || !editing) setWork(blocks);
  }, [blocks, editing, always]);

  const current = always ? blocks : editing ? work : blocks;
  const setCurrent = (next: ScheduleBlock[]) => {
    if (always) onChange(next);
    else setWork(next);
  };

  const overlaps = useMemo(() => overlappingBlockIds(current), [current]);

  const visibleDays: DayKey[] =
    editing && selectedDays.length > 0 ? DAYS.filter((d) => selectedDays.includes(d)) : [activeDay];

  // הפונקציה מחזירה את הבלוקים של יום מסוים, ממוינים לפי שעת התחלה
  const blocksFor = (day: DayKey) =>
    current.filter((b) => b.day === day).sort((a, b) => toMin(a.start_time) - toMin(b.start_time));

  const countFor = (day: DayKey) => current.filter((b) => b.day === day).length;
  // הפונקציה מחזירה אילו סוגי בלוקים יש ביום (לימוד/עבודה/אחר) כדי להציג את סמלי החיווי הקטנים
  const typesFor = (day: DayKey) => {
    const hasStudy = current.some((b) => b.day === day && b.type === "study");
    const hasBusy = current.some((b) => b.day === day && b.type !== "study");
    return { hasStudy, hasBusy, hasBlocks: hasStudy || hasBusy };
  };

  // הפונקציה מטפלת בלחיצה על יום: במצב צפייה מחליפה יום פעיל, במצב עריכה מסמנת/מסירה בחירה
  function toggleDay(d: DayKey) {
    if (!editing) return setActiveDay(d);
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  // הפונקציה מפעילה או מכבה את "עסוק כל היום" ומחזירה את השעות הקודמות בכיבוי
  function toggleAllDay(d: Draft) {
    setDraftError(null);
    if (isAllDay(d)) {
      const prev = prevTimes.current;
      setDraft({ ...d, start_time: prev.start_time, end_time: prev.end_time });
      return;
    }
    prevTimes.current = { start_time: d.start_time, end_time: d.end_time };
    setDraft({ ...d, start_time: ALL_DAY_START, end_time: ALL_DAY_END });
  }

  // הפונקציה נכנסת למצב עריכה עם העתק מקומי של הלו"ז והיום הפעיל מסומן
  function enterEdit() {
    setWork(blocks);
    setSelectedDays([activeDay]);
    setEditing(true);
  }

  // הפונקציה מבטלת את מצב העריכה וזורקת את כל השינויים שלא נשמרו
  function cancelEdit() {
    setWork(blocks);
    setSelectedDays([]);
    setDraft(null);
    setEditing(false);
  }

  // הפונקציה שומרת את הלו"ז הערוך פעם אחת אצל ההורה אחרי בדיקת חפיפות
  async function saveEdit() {
    if (overlappingBlockIds(work).size > 0)
      return toast.error("Two blocks overlap. Fix them before saving.");
    onChange(work);
    try {
      await onSave?.(work);
      setEditing(false);
      setSelectedDays([]);
    } catch {
      /* the parent surfaces its own error toast */
    }
  }

  // הפונקציה שומרת בלוק מהדיאלוג: עריכת בלוק קיים או יצירת בלוק נפרד בכל יום נבחר
  function saveDraft() {
    if (!draft) return;
    const days = draft.days;
    if (days.length === 0) return setDraftError("Select at least one day.");

    const err = validateBlock({ ...draft, day: days[0]! });
    if (err) return setDraftError(err);

    const label = (draft.label ?? "").trim() || null;

    if (draft.id) {
      // Editing an existing block only ever changes that one block.
      const day = days[0]!;
      const updated: ScheduleBlock = {
        id: draft.id,
        day,
        start_time: draft.start_time,
        end_time: draft.end_time,
        type: draft.type,
        label,
      };
      const next = current.map((b) => (b.id === draft.id ? updated : b));
      if (overlappingBlockIds(next).has(draft.id))
        return setDraftError(`This time overlaps another block on ${DAY_LABELS[day]}.`);
      setCurrent(next);
      setActiveDay(day);
    } else {
      // One add action creates an independent block on every selected day.
      const additions: ScheduleBlock[] = days.map((day) => ({
        id: newBlockId(),
        day,
        start_time: draft.start_time,
        end_time: draft.end_time,
        type: draft.type,
        label,
      }));
      const next = [...current, ...additions];
      const bad = overlappingBlockIds(next);
      const conflicting = additions.filter((a) => bad.has(a.id)).map((a) => DAY_LABELS[a.day]);
      if (conflicting.length > 0)
        return setDraftError(
          `This time overlaps existing blocks on ${conflicting.join(", ")}. Nothing was added.`,
        );
      setCurrent(next);
      setActiveDay(days[0]!);
    }

    setDraft(null);
    setDraftError(null);
  }

  // הפונקציה מעלה תמונת מערכת שעות, שולחת אותה ל-AI וממזגת את בלוקי הלימוד שזוהו לטיוטה
  async function handleFile(file: File | null) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB.");
    setImporting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("You are signed out. Please sign in again.");

      const { path } = await uploadTimetableImage(file, u.user.id);
      const result = await runImport({ data: { path } });

      if (!result.isTimetable || result.blocks.length === 0) {
        toast.error(
          "We couldn't identify a class timetable in this image. You can try another image or enter your schedule manually.",
        );
        return;
      }

      const merged = mergeImportedBlocks(current, result.blocks);
      setCurrent(merged.blocks);
      onImageImported?.(path);
      toast.success(
        `Imported ${merged.addedCount} study block${merged.addedCount === 1 ? "" : "s"}${
          merged.skipped ? ` (${merged.skipped} duplicate skipped)` : ""
        }. Review them before saving.`,
      );
      if (result.warnings.length) toast.info(result.warnings[0]!);
    } catch (e) {
      toast.error(friendlyMessage(e, "We couldn't read that image. Please try another one."));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const allSelected = selectedDays.length === DAYS.length;
  const addLabel =
    selectedDays.length > 1 ? `Add to ${selectedDays.length} days` : "Add time block";

  return (
    <div className="space-y-4">
      {/* מערכת השעות השבועית במצב צפייה או עריכה */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Your weekly schedule</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {editing
                ? "Tap days to select them, then add or edit blocks."
                : "Your classes (Study) and anything else you're busy with."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {current.length}
            </span>
            {!always && !editing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={enterEdit}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit schedule
              </Button>
            )}
          </div>
        </div>

        {editing && (
          /* סרגל בחירת ימים עם אפשרות לבחור או לנקות את כולם */
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedDays.length === 0
                ? "Select at least one day"
                : `${selectedDays.length} day${selectedDays.length === 1 ? "" : "s"} selected`}
            </span>
            <button
              type="button"
              onClick={() => setSelectedDays(allSelected ? [] : [...DAYS])}
              className="text-xs font-semibold text-primary"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
        )}

        {/* בורר ימי השבוע עם חיווי לימים שיש בהם בלוקים */}
        <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {DAYS.map((d) => {
            const active = editing ? selectedDays.includes(d) : d === activeDay;
            const { hasStudy, hasBusy, hasBlocks } = typesFor(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={editing ? active : undefined}
                onClick={() => toggleDay(d)}
                className={cn(
                  "flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : hasBlocks
                      ? "border-primary/25 bg-primary/[0.05] text-foreground hover:bg-primary/[0.09]"
                      : "border-border/60 bg-card text-muted-foreground hover:bg-muted/50",
                  editing && active && "ring-2 ring-primary/30 ring-offset-1 ring-offset-card",
                )}
              >
                {DAY_SHORT[d]}
                <span
                  className={cn("text-[10px] font-medium", active ? "opacity-80" : "opacity-60")}
                >
                  {countFor(d)}
                </span>
                {!active && hasBlocks && (
                  <span className="flex items-center gap-1" aria-hidden>
                    {hasStudy && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    {hasBusy && <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* רשימת בלוקי הזמן עבור הימים המוצגים */}
        <div className="mt-4 space-y-4">
          {visibleDays.map((day) => {
            const dayBlocks = blocksFor(day);
            return (
              <div key={day} className="space-y-2.5">
                {visibleDays.length > 1 && (
                  <p className="text-xs font-semibold text-muted-foreground">{DAY_LABELS[day]}</p>
                )}

                {dayBlocks.length === 0 && (
                  /* מצב קומפקטי ליום שאין בו בלוקים */
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 px-3 py-2.5 text-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Nothing on {DAY_LABELS[day]}</p>
                  </div>
                )}

                {dayBlocks.map((b) => {
                  const study = b.type === "study";
                  const bad = overlaps.has(b.id);
                  const Icon = TYPE_ICON[b.type];
                  return (
                    <div
                      key={b.id}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3",
                        bad
                          ? "border-destructive/50 bg-destructive/5"
                          : study
                            ? "border-primary/25 bg-primary/5"
                            : b.type === "work"
                              ? "border-border/60 bg-muted/40"
                              : "border-border/60 bg-muted/25",
                      )}
                    >
                      {/* פרטי בלוק בודד ופעולות עריכה או מחיקה */}
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          study ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground",
                        )}
                        aria-hidden
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {b.label ?? BLOCK_TYPE_LABELS[b.type]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.start_time}–{b.end_time} · {BLOCK_TYPE_LABELS[b.type]}
                        </p>
                        {bad && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5" /> Overlaps another block
                          </p>
                        )}
                      </div>
                      {editing && (
                        <>
                          <button
                            type="button"
                            aria-label="Edit block"
                            onClick={() => {
                              setDraftError(null);
                              setDraft({ ...b, days: [b.day] });
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete block"
                            onClick={() => setCurrent(current.filter((x) => x.id !== b.id))}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {editing && (
          /* כפתור להוספת בלוק לכל הימים שנבחרו */
          <button
            type="button"
            disabled={selectedDays.length === 0}
            onClick={() => {
              setDraftError(null);
              setDraft(emptyDraft(selectedDays));
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-muted/50 disabled:opacity-50"
          >
            <Plus className="h-4.5 w-4.5 text-primary" />
            {selectedDays.length === 0 ? "Select a day to add a block" : addLabel}
          </button>
        )}

        {!always && editing && (
          /* פעולות לשמירת הטיוטה או לביטול השינויים */
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 rounded-xl"
              disabled={saving}
              onClick={cancelEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl"
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        )}
      </section>

      {/* כלי לייבוא בלוקי לימוד מתמונת מערכת שעות */}
      {(always || editing) && (
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              {importing ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <ImagePlus className="h-4.5 w-4.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Import from a timetable image</p>
              <p className="text-xs text-muted-foreground">
                Optional — we'll read it and fill the blocks for you to review.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl"
            >
              {importing ? "Reading…" : "Upload"}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
        </section>
      )}

      {/* חלונית להוספה או עריכה של בלוק זמן */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[400px] overflow-x-hidden rounded-2xl p-5 sm:p-6">
          <DialogHeader className="min-w-0">
            <DialogTitle className="break-words">
              {draft?.id ? "Edit block" : "Add time block"}
            </DialogTitle>
            <DialogDescription className="break-words">
              {draft && !draft.id && draft.days.length > 1
                ? `Creates a separate block on ${draft.days.length} days — you can edit each one later.`
                : "Study is your classes. Work and Other are anything else."}
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="min-w-0 space-y-4">
              {/* בחירת סוג הבלוק: לימוד, עבודה או אחר */}
              <div className="grid grid-cols-3 gap-2">
                {(["study", "work", "other"] as BlockType[]).map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft({ ...draft, type: t })}
                      className={cn(
                        "flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-xs font-semibold transition-colors",
                        draft.type === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{BLOCK_TYPE_LABELS[t]}</span>
                    </button>
                  );
                })}
              </div>

              {/* בחירת הימים שאליהם יתווסף הבלוק */}
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {DAYS.map((d) => {
                  const on = draft.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          days: draft.id
                            ? [d]
                            : on
                              ? draft.days.filter((x) => x !== d)
                              : [...draft.days, d],
                        })
                      }
                      className={cn(
                        "min-w-0 rounded-xl border px-1 py-1.5 text-xs font-semibold transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {DAY_SHORT[d]}
                    </button>
                  );
                })}
              </div>

              {/* פעולה מהירה: סימון היום כולו כתפוס */}
              <button
                type="button"
                onClick={() => toggleAllDay(draft)}
                aria-pressed={isAllDay(draft)}
                className={cn(
                  "flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors",
                  isAllDay(draft)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span className="truncate">Busy all day</span>
                <span className="shrink-0 text-[11px] font-medium">
                  {isAllDay(draft) ? "On · 00:00–23:59" : "Off"}
                </span>
              </button>

              {/* שדות שעת ההתחלה ושעת הסיום */}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                <label className="min-w-0 text-xs font-medium text-muted-foreground">
                  Start
                  <Input
                    type="time"
                    value={draft.start_time}
                    disabled={isAllDay(draft)}
                    onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                    className="mt-1 h-11 w-full min-w-0 rounded-xl px-2"
                  />
                </label>
                <label className="min-w-0 text-xs font-medium text-muted-foreground">
                  End
                  <Input
                    type="time"
                    value={draft.end_time}
                    disabled={isAllDay(draft)}
                    onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                    className="mt-1 h-11 w-full min-w-0 rounded-xl px-2"
                  />
                </label>
              </div>

              {/* שדה אופציונלי לשם או לתיאור הבלוק */}
              <label className="block min-w-0 text-xs font-medium text-muted-foreground">
                Label (optional)
                <Input
                  value={draft.label ?? ""}
                  maxLength={80}
                  placeholder={draft.type === "study" ? "Database Systems" : "Work"}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  className="mt-1 h-11 w-full min-w-0 rounded-xl"
                />
              </label>

              {draftError && (
                /* הודעת שגיאה עבור פרטי בלוק לא תקינים או חופפים */
                <p
                  role="alert"
                  className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
                >
                  {draftError}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={saveDraft}>
              {draft && !draft.id && draft.days.length > 1
                ? `Add to ${draft.days.length} days`
                : "Save block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
