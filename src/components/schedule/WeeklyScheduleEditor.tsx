import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Briefcase, Clock, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
  DAYS,
  DAY_LABELS,
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

const emptyDraft = (day: DayKey): ScheduleBlock => ({
  id: "",
  day,
  start_time: "10:00",
  end_time: "12:00",
  type: "study",
  label: null,
});

export function WeeklyScheduleEditor({ blocks, onChange, onImageImported }: Props) {
  const [activeDay, setActiveDay] = useState<DayKey>(DAYS[new Date().getDay()]!);
  const [draft, setDraft] = useState<ScheduleBlock | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runImport = useServerFn(importTimetableImage);

  const overlaps = useMemo(() => overlappingBlockIds(blocks), [blocks]);
  const dayBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b.day === activeDay)
        .sort((a, b) => toMin(a.start_time) - toMin(b.start_time)),
    [blocks, activeDay],
  );
  const countFor = (day: DayKey) => blocks.filter((b) => b.day === day).length;

  function saveDraft() {
    if (!draft) return;
    const err = validateBlock(draft);
    if (err) return setDraftError(err);
    const clean: ScheduleBlock = {
      ...draft,
      id: draft.id || newBlockId(),
      label: (draft.label ?? "").trim() || null,
    };
    onChange(draft.id ? blocks.map((b) => (b.id === draft.id ? clean : b)) : [...blocks, clean]);
    setActiveDay(clean.day);
    setDraft(null);
    setDraftError(null);
  }

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

      const merged = mergeImportedBlocks(blocks, result.blocks);
      onChange(merged.blocks);
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

  return (
    <div className="space-y-4">
      {/* PRIMARY: manual weekly schedule */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Your weekly schedule</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your classes (Study) and anything else you're busy with.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {blocks.length}
          </span>
        </div>

        <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {DAYS.map((d) => {
            const active = d === activeDay;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDay(d)}
                className={cn(
                  "flex min-w-[52px] flex-col items-center gap-0.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-card text-muted-foreground hover:bg-muted/50",
                )}
              >
                {DAY_SHORT[d]}
                <span className={cn("text-[10px] font-medium", active ? "opacity-80" : "opacity-60")}>
                  {countFor(d)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2.5">
          {dayBlocks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center">
              <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Nothing on {DAY_LABELS[activeDay]}</p>
              <p className="mt-1 text-xs text-muted-foreground">Add a study or busy block below.</p>
            </div>
          )}

          {dayBlocks.map((b) => {
            const study = b.type === "study";
            const bad = overlaps.has(b.id);
            return (
              <div
                key={b.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3",
                  bad
                    ? "border-destructive/50 bg-destructive/5"
                    : study
                      ? "border-primary/25 bg-primary/5"
                      : "border-border/60 bg-muted/40",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    study ? "bg-primary/10 text-primary" : "bg-foreground/10 text-foreground",
                  )}
                  aria-hidden
                >
                  {study ? <BookOpen className="h-4.5 w-4.5" /> : <Briefcase className="h-4.5 w-4.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {b.label ?? (study ? "Class" : "Busy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.start_time}–{b.end_time} · {study ? "Study" : "Busy (B)"}
                  </p>
                  {bad && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> Overlaps another block
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Edit block"
                  onClick={() => {
                    setDraftError(null);
                    setDraft(b);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete block"
                  onClick={() => onChange(blocks.filter((x) => x.id !== b.id))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setDraftError(null);
            setDraft(emptyDraft(activeDay));
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-muted/50"
        >
          <Plus className="h-4.5 w-4.5 text-primary" />
          Add time block
        </button>
      </section>

      {/* SECONDARY: image import helper */}
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {importing ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ImagePlus className="h-4.5 w-4.5" />}
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

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-[360px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit block" : "Add time block"}</DialogTitle>
            <DialogDescription>Study is your classes. Busy is anything else.</DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["study", "busy"] as BlockType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft({ ...draft, type: t })}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                      draft.type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {t === "study" ? <BookOpen className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                    {t === "study" ? "Study" : "Busy"}
                  </button>
                ))}
              </div>

              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDraft({ ...draft, day: d })}
                    className={cn(
                      "min-w-[48px] rounded-xl border px-2 py-1.5 text-xs font-semibold transition-colors",
                      draft.day === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    {DAY_SHORT[d]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Start
                  <Input
                    type="time"
                    value={draft.start_time}
                    onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  End
                  <Input
                    type="time"
                    value={draft.end_time}
                    onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
                    className="mt-1 h-11 rounded-xl"
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-muted-foreground">
                Label (optional)
                <Input
                  value={draft.label ?? ""}
                  maxLength={80}
                  placeholder={draft.type === "study" ? "Database Systems" : "Work"}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  className="mt-1 h-11 rounded-xl"
                />
              </label>

              {draftError && (
                <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  {draftError}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={saveDraft}>
              Save block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
