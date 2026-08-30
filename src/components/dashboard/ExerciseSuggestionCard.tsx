import { Card } from "@/components/ui/card";
import { Check, Timer } from "lucide-react";
import type { ExerciseOption } from "@/lib/exercise-replacement.functions";

export function ExerciseSuggestionCard({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: ExerciseOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const pretty = (s: string) => s.replace(/_/g, " ");
  return (
    <Card
      className={`gap-0 rounded-2xl border p-4 shadow-soft transition-colors ${
        selected ? "border-primary/50 bg-primary/5" : "border-border/70"
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className="w-full text-left disabled:opacity-60"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-[15px] font-bold leading-5">{option.exercise_name}</h4>
            <p className="mt-1 text-[12px] capitalize text-muted-foreground">
              {pretty(option.muscle)} • {pretty(option.family)} • {pretty(option.equipment)}
            </p>
          </div>
          {selected ? (
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          {option.sets ? <span>{option.sets} sets</span> : null}
          {option.reps ? <span>{option.reps} reps</span> : null}
          {option.duration_seconds ? (
            <span className="flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {option.duration_seconds}s
            </span>
          ) : null}
          {option.rest_seconds ? <span>{option.rest_seconds}s rest</span> : null}
        </div>

        <p className="mt-2 text-[12px] leading-4 text-muted-foreground">{option.rationale}</p>
      </button>
    </Card>
  );
}
