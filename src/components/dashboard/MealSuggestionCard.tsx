import { Card } from "@/components/ui/card";
import { Check, Flame } from "lucide-react";
import type { MealReplacement } from "@/lib/replacement-schema";

// הקומפוננטה מציגה כרטיס של הצעת ארוחה חלופית אחת שניתן לבחור
export function MealSuggestionCard({
  meal,
  selected,
  disabled,
  onSelect,
}: {
  meal: MealReplacement;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`gap-0 rounded-2xl border p-4 text-left shadow-soft transition-colors ${
        selected ? "border-success/50 bg-success/5" : "border-border/70"
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
            <h4 className="text-[15px] font-bold leading-5">{meal.meal_name}</h4>
            <p className="mt-1 text-[13px] leading-4 text-muted-foreground">
              {meal.short_description}
            </p>
          </div>
          {selected ? (
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-warning">
            <Flame className="h-3.5 w-3.5" />
            {meal.calories} cal
          </span>
          <span>P {Math.round(meal.protein)}g</span>
          <span>C {Math.round(meal.carbohydrates)}g</span>
          <span>F {Math.round(meal.fats)}g</span>
        </div>

        {meal.fit_note ? (
          <p className="mt-2 text-[12px] leading-4 text-muted-foreground">{meal.fit_note}</p>
        ) : null}
      </button>
    </Card>
  );
}
