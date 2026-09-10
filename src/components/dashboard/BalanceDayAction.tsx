import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Scale, X } from "lucide-react";
import { toast } from "sonner";
import { friendlyMessage } from "@/lib/friendly-errors";
import { balanceMealDay } from "@/lib/meal-replacement.functions";

export type BalanceState = {
  planId: string;
  mealDayId: string;
  lockedMealItemId: string;
  lockedMealName: string;
  totals: { calories: number; protein: number };
  targets: { calories: number; protein: number };
};

/**
 * Optional, dismissible action shown only after a replacement moved the day's
 * totals meaningfully away from target. Doing nothing keeps the day as-is.
 */
export function BalanceDayAction({
  state,
  onDismiss,
  onBalanced,
}: {
  state: BalanceState;
  onDismiss: () => void;
  onBalanced: () => void;
}) {
  const balance = useServerFn(balanceMealDay);
  const [busy, setBusy] = useState(false);

  const diff = state.totals.calories - state.targets.calories;
  const direction = diff > 0 ? "over" : "under";

  // הפונקציה שולחת בקשה לשרת לאזן את שאר ארוחות היום סביב הארוחה שנעולה
  const run = async () => {
    setBusy(true);
    try {
      await balance({
        data: {
          planId: state.planId,
          mealDayId: state.mealDayId,
          lockedMealItemId: state.lockedMealItemId,
        },
      });
      toast.success("Your day is balanced");
      onBalanced();
    } catch (e) {
      toast.error(friendlyMessage(e, "Balancing didn't work this time. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    /* כרטיס שמציע לאזן את שאר ארוחות היום */
    <Card className="gap-0 rounded-2xl border-warning/40 bg-warning/5 p-4 shadow-soft">
      <div className="flex items-start gap-2">
        <Scale className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold leading-5">Balance my day?</h3>
          <p className="mt-1 text-[13px] leading-4 text-muted-foreground">
            Today is {Math.abs(diff)} cal {direction} target ({state.totals.calories} vs{" "}
            {state.targets.calories}). We can adjust your other meals — {state.lockedMealName} stays
            exactly as you chose it.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* כפתור להפעלת איזון הארוחות */}
      <Button
        className="mt-3 h-11 w-full rounded-2xl bg-warning text-warning-foreground hover:bg-warning/90"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Balancing…
          </>
        ) : (
          "Balance my day"
        )}
      </Button>
    </Card>
  );
}
