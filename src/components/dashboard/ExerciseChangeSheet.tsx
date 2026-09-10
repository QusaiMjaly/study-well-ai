import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2, Search, Sparkles } from "lucide-react";
import { ExerciseSuggestionCard } from "@/components/dashboard/ExerciseSuggestionCard";
import { friendlyMessage } from "@/lib/friendly-errors";
import { localDateKey } from "@/lib/meals-data";
import type { WorkoutExercise } from "@/lib/workouts-data";
import {
  applyExerciseReplacement,
  requestSpecificExerciseReplacement,
  suggestExerciseReplacements,
  type ExerciseOption,
} from "@/lib/exercise-replacement.functions";

type Mode = "suggest" | "request";

// הקומפוננטה מציגה את חלון החלפת התרגיל: הצעות AI, בקשת תרגיל ספציפי ושמירת הבחירה
export function ExerciseChangeSheet({
  exercise,
  planId,
  completedToday,
  open,
  onOpenChange,
  onApplied,
}: {
  exercise: WorkoutExercise | null;
  planId: string;
  completedToday: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied: (name: string) => void;
}) {
  const suggest = useServerFn(suggestExerciseReplacements);
  const requestSpecific = useServerFn(requestSpecificExerciseReplacement);
  const apply = useServerFn(applyExerciseReplacement);

  const [mode, setMode] = useState<Mode>("suggest");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ExerciseOption[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [request, setRequest] = useState("");
  const [confirmNeeded, setConfirmNeeded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("suggest");
    setOptions(null);
    setSelected(null);
    setRequest("");
    setError(null);
    setConfirmNeeded(false);
    setApplying(false);
  }, [open, exercise?.id]);

  // הפונקציה טוענת מהשרת שלוש הצעות AI לתרגילים חלופיים
  const loadSuggestions = async () => {
    if (!exercise) return;
    setLoading(true);
    setError(null);
    setOptions(null);
    setSelected(null);
    try {
      const res = await suggest({ data: { exerciseId: exercise.id, planId } });
      setOptions(res.suggestions);
    } catch (e) {
      setError(friendlyMessage(e, "We couldn't load alternatives. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && exercise && mode === "suggest" && !options && !loading && !error) {
      void loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exercise?.id, mode]);

  // הפונקציה שולחת את התרגיל הספציפי שהמשתמש ביקש לחיפוש מול הקטלוג
  const submitRequest = async () => {
    if (!exercise || request.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setOptions(null);
    setSelected(null);
    try {
      const res = await requestSpecific({
        data: { exerciseId: exercise.id, planId, request: request.trim() },
      });
      if (res.status === "ok") {
        setOptions([res.option]);
        setSelected(0);
        return;
      }
      setError(res.message);
    } catch (e) {
      setError(friendlyMessage(e, "We couldn't match that exercise. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // הפונקציה שומרת את התרגיל החדש שנבחר במקום הישן (עם אישור אם הוא כבר סומן כ"בוצע")
  const doApply = async (confirm: boolean) => {
    if (!exercise || selected === null || !options) return;
    const choice = options[selected]!;
    setApplying(true);
    setError(null);
    try {
      const res = await apply({
        data: {
          exerciseId: exercise.id,
          planId,
          expectedSlug: exercise.exercise_slug ?? null,
          expectedOrder: exercise.exercise_order,
          today: localDateKey(),
          confirmCompleted: confirm,
          selection: {
            exercise_slug: choice.exercise_slug,
            sets: choice.sets,
            reps: choice.reps,
            duration_seconds: choice.duration_seconds,
            rest_seconds: choice.rest_seconds,
            notes: choice.notes,
          },
        },
      });
      if (res.status === "needs_confirmation") {
        setConfirmNeeded(true);
        return;
      }
      onApplied(res.exerciseName);
      onOpenChange(false);
    } catch (e) {
      setError(friendlyMessage(e, "The replacement couldn't be saved. Please try again."));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[88vh] w-full max-w-[448px] overflow-y-auto rounded-t-3xl border-border/70 p-0"
      >
        {/* כותרת חלונית החלפת התרגיל */}
        <SheetHeader className="px-5 pb-2 pt-5 text-left">
          <SheetTitle className="text-[20px] font-bold leading-7">Change exercise</SheetTitle>
          <p className="text-[13px] text-muted-foreground">
            Swapping {exercise?.exercise_name ?? "this exercise"} — the rest of your workout stays
            the same.
          </p>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-8">
          {/* בחירה בין הצעות AI לבין בקשת תרגיל מסוים */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1">
            {(["suggest", "request"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  if (m === "request") {
                    setOptions(null);
                    setSelected(null);
                  }
                }}
                className={`rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
                  mode === m ? "bg-background text-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {m === "suggest" ? "AI suggestions" : "Request one"}
              </button>
            ))}
          </div>

          {completedToday ? (
            /* אזהרה כאשר התרגיל כבר סומן כהושלם */
            <p className="flex items-start gap-2 rounded-2xl bg-warning/10 px-3 py-2.5 text-[12px] leading-4 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              You already completed this exercise today. Changing it will mark the replacement as
              not completed.
            </p>
          ) : null}

          {mode === "request" ? (
            /* שדה להזנת שם התרגיל המבוקש */
            <div className="flex gap-2">
              <Input
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="e.g. Pull-ups, bench press, goblet squat"
                className="h-12 rounded-2xl"
                onKeyDown={(e) => e.key === "Enter" && void submitRequest()}
              />
              <Button
                onClick={() => void submitRequest()}
                disabled={loading || request.trim().length < 2}
                className="h-12 shrink-0 rounded-2xl"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          ) : null}

          {loading ? (
            /* מצב טעינה בזמן חיפוש חלופות */
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
              <p className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Finding alternatives from your exercise
                library…
              </p>
            </div>
          ) : null}

          {error ? (
            /* הודעת שגיאה ואפשרות לנסות שוב */
            <div className="rounded-2xl border border-border/70 p-4 text-center">
              <p className="text-[13px] leading-5 text-muted-foreground">{error}</p>
              {mode === "suggest" ? (
                <Button
                  variant="outline"
                  className="mt-3 rounded-xl"
                  onClick={() => void loadSuggestions()}
                >
                  Try again
                </Button>
              ) : null}
            </div>
          ) : null}

          {!loading && options
            ? options.map((o, i) => (
                /* כרטיס תרגיל חלופי לבחירה */
                <ExerciseSuggestionCard
                  key={o.exercise_slug}
                  option={o}
                  selected={selected === i}
                  disabled={applying}
                  onSelect={() => setSelected(i)}
                />
              ))
            : null}

          {confirmNeeded ? (
            /* אישור החלפת תרגיל שכבר סומן כהושלם */
            <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4">
              <p className="text-[13px] leading-5">
                You already completed this exercise today. Changing it will mark the replacement as
                not completed.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="ghost"
                  className="h-11 flex-1 rounded-2xl border border-border/70"
                  onClick={() => setConfirmNeeded(false)}
                  disabled={applying}
                >
                  Cancel
                </Button>
                <Button
                  className="h-11 flex-1 rounded-2xl"
                  onClick={() => void doApply(true)}
                  disabled={applying}
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replace anyway"}
                </Button>
              </div>
            </div>
          ) : (
            /* כפתור החלת התרגיל החלופי שנבחר */
            <Button
              className="h-12 w-full rounded-2xl"
              disabled={selected === null || applying || loading}
              onClick={() => void doApply(false)}
            >
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…
                </>
              ) : (
                "Use this exercise"
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
