import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Loader2, Search, Sparkles } from "lucide-react";
import { MealSuggestionCard } from "@/components/dashboard/MealSuggestionCard";
import { friendlyMessage } from "@/lib/friendly-errors";
import { localDateKey, type MealItem } from "@/lib/meals-data";
import type { MealReplacement } from "@/lib/replacement-schema";
import {
  applyMealReplacement,
  requestSpecificMealReplacement,
  suggestMealReplacements,
  type MealApplyResult,
} from "@/lib/meal-replacement.functions";

type Mode = "suggest" | "request";
type RequestMode = "fit_plan" | "as_described";

const REQUEST_MODES: { id: RequestMode; label: string; subtitle: string }[] = [
  {
    id: "fit_plan",
    label: "Make it fit my plan",
    subtitle: "Adjust portions and ingredients to better match my goals.",
  },
  {
    id: "as_described",
    label: "Keep it as I described",
    subtitle: "Estimate the meal as-is. You can balance the rest of your day afterward.",
  },
];

export function MealChangeSheet({
  meal,
  planId,
  completedToday,
  open,
  onOpenChange,
  onApplied,
}: {
  meal: MealItem | null;
  planId: string;
  completedToday: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied: (result: Extract<MealApplyResult, { status: "applied" }>) => void;
}) {
  const suggest = useServerFn(suggestMealReplacements);
  const requestSpecific = useServerFn(requestSpecificMealReplacement);
  const apply = useServerFn(applyMealReplacement);

  const [mode, setMode] = useState<Mode>("suggest");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<MealReplacement[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [request, setRequest] = useState("");
  const [requestMode, setRequestMode] = useState<RequestMode>("fit_plan");
  const [confirmNeeded, setConfirmNeeded] = useState(false);


  useEffect(() => {
    if (!open) return;
    setMode("suggest");
    setOptions(null);
    setSelected(null);
    setRequest("");
    setRequestMode("fit_plan");
    setError(null);
    setConfirmNeeded(false);
    setApplying(false);
  }, [open, meal?.id]);

  const loadSuggestions = async () => {
    if (!meal) return;
    setLoading(true);
    setError(null);
    setOptions(null);
    setSelected(null);
    try {
      const res = await suggest({ data: { mealItemId: meal.id, planId } });
      setOptions(res.suggestions);
    } catch (e) {
      setError(friendlyMessage(e, "We couldn't load suggestions. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && meal && mode === "suggest" && !options && !loading && !error) {
      void loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meal?.id, mode]);

  const submitRequest = async () => {
    if (!meal || request.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setOptions(null);
    setSelected(null);
    try {
      const res = await requestSpecific({
        data: { mealItemId: meal.id, planId, request: request.trim(), mode: requestMode },
      });
      if (res.status !== "ok" || !res.meal) {
        setError(res.message ?? "That request didn't work. Try describing it differently.");
        return;
      }
      setOptions([res.meal]);
      setSelected(0);
    } catch (e) {
      setError(friendlyMessage(e, "We couldn't build that meal. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const doApply = async (confirm: boolean) => {
    if (!meal || selected === null || !options) return;
    setApplying(true);
    setError(null);
    try {
      const res = await apply({
        data: {
          mealItemId: meal.id,
          planId,
          expectedMealName: meal.meal_name,
          expectedMealOrder: meal.meal_order,
          today: localDateKey(),
          confirmCompleted: confirm,
          replacement: options[selected]!,
        },
      });
      if (res.status === "needs_confirmation") {
        setConfirmNeeded(true);
        return;
      }
      onApplied(res);
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
        <SheetHeader className="px-5 pb-2 pt-5 text-left">
          <SheetTitle className="text-[20px] font-bold leading-7">Change meal</SheetTitle>
          <p className="text-[13px] text-muted-foreground">
            Replacing {meal?.meal_name ?? "this meal"} — the rest of your plan stays the same.
          </p>
        </SheetHeader>

        <div className="space-y-4 px-5 pb-8">
          {/* Mode switch */}
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
                {m === "suggest" ? "AI suggestions" : "Request a meal"}
              </button>
            ))}
          </div>

          {completedToday ? (
            <p className="flex items-start gap-2 rounded-2xl bg-warning/10 px-3 py-2.5 text-[12px] leading-4 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              You already completed this meal today. Changing it will mark the replacement as not
              completed.
            </p>
          ) : null}

          {mode === "request" ? (
            <div className="space-y-3">
              <div className="grid gap-2">
                {REQUEST_MODES.map((rm) => {
                  const active = requestMode === rm.id;
                  return (
                    <button
                      key={rm.id}
                      type="button"
                      onClick={() => setRequestMode(rm.id)}
                      aria-pressed={active}
                      className={`rounded-2xl border p-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border/70 bg-background hover:bg-muted/50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            active ? "border-primary" : "border-border"
                          }`}
                        >
                          {active ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                        </span>
                        <span className="text-[14px] font-semibold leading-5">{rm.label}</span>
                      </span>
                      <span className="mt-1 block pl-6 text-[12px] leading-4 text-muted-foreground">
                        {rm.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Input
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder={
                    requestMode === "as_described"
                      ? "e.g. Double cheeseburger, regular bun, 2 patties, cheese, mayo, medium fries"
                      : "e.g. Chicken pasta, shawarma, pancakes"
                  }
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

              {requestMode === "as_described" ? (
                <p className="text-[12px] leading-4 text-muted-foreground">
                  Nutrition will be an estimate — the more detail you give, the closer it gets.
                </p>
              ) : null}
            </div>
          ) : null}


          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
              <p className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Creating options that fit your day…
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-border/70 p-4 text-center">
              <p className="text-[13px] text-muted-foreground">{error}</p>
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
                <MealSuggestionCard
                  key={`${o.meal_name}-${i}`}
                  meal={o}
                  selected={selected === i}
                  disabled={applying}
                  onSelect={() => setSelected(i)}
                />
              ))
            : null}

          {confirmNeeded ? (
            <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4">
              <p className="text-[13px] leading-5">
                You already completed this meal today. Changing it will mark the replacement as not
                completed.
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
            <Button
              className="h-12 w-full rounded-2xl bg-success text-success-foreground hover:bg-success/90"
              disabled={selected === null || applying || loading}
              onClick={() => void doApply(false)}
            >
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…
                </>
              ) : (
                "Use this meal"
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
