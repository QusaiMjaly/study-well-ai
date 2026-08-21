import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecipeSheet } from "@/components/dashboard/RecipeSheet";
import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Clock, Flame, Sparkles, Utensils } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/dashboard-data";
import { fetchTodayMeals, setMealCompleted, type MealItem } from "@/lib/meals-data";
import { DataError } from "@/components/dashboard/DataError";
import { friendlyMessage } from "@/lib/friendly-errors";

export function MealsPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["today-meals"],
    queryFn: () => fetchTodayMeals(),
    staleTime: 60_000,
  });


  const toggle = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      setMealCompleted(id, completed),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["today-meals"] });
      qc.invalidateQueries({ queryKey: ["active-plan"] });
    },
    onError: (e) => toast.error(friendlyMessage(e)),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[188px] w-full rounded-3xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <DataError title="Couldn't load your meals" error={error} onRetry={() => refetch()} />
    );
  }


  if (!data) {
    return (
      <Card className="rounded-2xl p-10 text-center shadow-soft">
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 font-semibold">No active plan yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your personalized AI plan to see your meals.
        </p>
        <Link to="/onboarding">
          <Button className="mt-4 h-12 rounded-2xl">Generate New Plan</Button>
        </Link>
      </Card>
    );
  }

  const completed = new Set(data.completedIds);
  const consumedCalories = data.meals
    .filter((m) => completed.has(m.id))
    .reduce((s, m) => s + (m.calories ?? 0), 0);
  const consumedProtein = data.meals
    .filter((m) => completed.has(m.id))
    .reduce((s, m) => s + Number(m.protein ?? 0), 0);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <section className="bg-meals-gradient rounded-3xl px-6 pb-6 pt-6 text-success-foreground shadow-card">
        <div className="flex items-center gap-2 text-[14px] font-medium">
          <Sparkles className="h-[18px] w-[18px]" />
          AI Personalized
        </div>
        <h2 className="mt-3 text-[24px] font-bold leading-8">Today's Meal Plan</h2>
        <p className="mt-1 text-[14px] opacity-85">{dateLabel}</p>

        <div className="mt-5 space-y-4 rounded-2xl bg-white/15 p-4">
          <ProgressRow
            label="Daily Calories"
            value={Math.round(consumedCalories)}
            target={data.targetCalories}
            unit="cal"
          />
          <ProgressRow
            label="Protein"
            value={Math.round(consumedProtein)}
            target={data.targetProtein}
            unit="g"
          />
        </div>
      </section>

      {/* MEAL CARDS */}
      {data.meals.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center shadow-soft">
          <Utensils className="mx-auto h-8 w-8 text-success" />
          <h3 className="mt-3 font-semibold">No meals scheduled for today</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your plan has no meals for {data.dayName}.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.meals.map((m) => (
            <MealCard
              key={m.id}
              meal={m}
              done={completed.has(m.id)}
              busy={toggle.isPending && toggle.variables?.id === m.id}
              onToggle={() => toggle.mutate({ id: m.id, completed: !completed.has(m.id) })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressRow({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[14px]">
        <span className="opacity-90">{label}</span>
        <span className="font-semibold">
          {value} / {target} {unit}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full bg-white transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MealCard({
  meal,
  done,
  busy,
  onToggle,
}: {
  meal: MealItem;
  done: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={`gap-0 rounded-2xl border p-4 shadow-soft transition-colors ${
        done ? "border-success/40 bg-success/5" : "border-border/70"
      }`}
    >
      {/* badges */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-medium capitalize text-primary">
          {meal.meal_type ?? "Meal"}
        </span>
        {done ? (
          <span className="flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-[12px] font-medium text-success">
            <Check className="h-3 w-3" /> Completed
          </span>
        ) : null}
      </div>

      {/* title + meta */}
      <h3 className="mt-2.5 text-[18px] font-bold leading-6">{meal.meal_name}</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {formatTime(meal.scheduled_time)}
        </span>
        {meal.calories != null ? (
          <span className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-warning" />
            {meal.calories} cal
          </span>
        ) : null}
      </div>

      {/* macros */}
      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <Macro label="Protein" value={meal.protein} tone="protein" />
        <Macro label="Carbs" value={meal.carbohydrates} tone="carbs" />
        <Macro label="Fats" value={meal.fats} tone="fats" />
      </div>

      {/* ingredients */}
      {meal.ingredients?.length ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {meal.ingredients.map((ing, i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-3 py-1.5 text-[12px] leading-4 text-muted-foreground"
            >
              {ing}
            </span>
          ))}
        </div>
      ) : null}

      {meal.notes ? (
        <p className="mt-3 text-[12px] leading-4 text-muted-foreground">{meal.notes}</p>
      ) : null}

      <Button
        onClick={onToggle}
        disabled={busy}
        variant="ghost"
        className={`mt-4 h-12 w-full rounded-2xl text-[14px] font-semibold transition-colors ${
          done
            ? "border border-success/30 bg-success/10 text-success hover:bg-success/15"
            : "bg-success text-success-foreground shadow-soft hover:bg-success/90"
        }`}
      >
        {done ? (
          <>
            <Check className="mr-2 h-4 w-4" /> Completed
          </>
        ) : (
          "Mark as Completed"
        )}
      </Button>
    </Card>
  );
}

const MACRO_TONES = {
  protein: "bg-primary/8 text-primary",
  carbs: "bg-success/10 text-success",
  fats: "bg-warning/10 text-warning",
} as const;

function Macro({
  value,
  label,
  tone,
}: {
  value: number | null;
  label: string;
  tone: keyof typeof MACRO_TONES;
}) {
  return (
    <div className={`rounded-xl px-2 py-2.5 text-center ${MACRO_TONES[tone]}`}>
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[16px] font-bold">{value != null ? `${value}g` : "—"}</div>
    </div>
  );
}
