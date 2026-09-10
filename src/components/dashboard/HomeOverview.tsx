import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dumbbell, Apple, Sparkles, ChevronRight } from "lucide-react";
import { DataError } from "@/components/dashboard/DataError";

import {
  fetchActivePlan,
  pickNextWorkout,
  pickNextMeal,
  todaySummary,
  todayTip,
  formatTime,
} from "@/lib/dashboard-data";

type Props = {
  onOpenWorkouts?: () => void;
  onOpenMeals?: () => void;
};

// הקומפוננטה מציגה את מסך הבית: האימון והארוחה הבאים, סיכום היום והטיפ היומי של ה-AI
export function HomeOverview({ onOpenWorkouts, onOpenMeals }: Props) {
  const { data: plan, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["active-plan"],
    queryFn: fetchActivePlan,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-3 rounded-[24px] p-6 shadow-soft">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-36" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <DataError
        title="Couldn't load your plan"
        error={error}
        onRetry={() => refetch()}
        className="rounded-[24px] p-6"
      />
    );
  }


  if (!plan) return <NoPlan />;

  const workout = pickNextWorkout(plan);
  const meal = pickNextMeal(plan);
  const summary = todaySummary(plan);
  const tip = todayTip(plan);

  return (
    <div className="space-y-4">
      {/* NEXT WORKOUT */}
      <section className="rounded-[24px] bg-gradient-to-br from-primary/10 to-primary/[0.03] p-6 shadow-soft">
        <div className="flex min-h-[56px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-soft">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Next Workout</p>
              <p className="text-2xl font-bold leading-8 tracking-tight">
                {workout ? formatTime(workout.scheduled_start) : "—"}
              </p>
            </div>
          </div>
          {workout?.day_name ? (
            <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
              {workout.day_name}
            </span>
          ) : null}
        </div>

        {workout ? (
          <div className="mt-5 flex min-h-[48px] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">
                {workout.workout_title ?? workout.workout_type ?? "Workout"}
              </p>
              <p className="text-sm text-muted-foreground">
                {workout.duration_minutes ?? "—"} min ·{" "}
                {workout.estimated_calories ?? "—"} kcal
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenWorkouts}
              aria-label="Open workouts"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <EmptyInline label="No upcoming workout in your plan." />
        )}
      </section>

      {/* NEXT MEAL */}
      <section className="rounded-[24px] bg-gradient-to-br from-success/10 to-success/[0.03] p-6 shadow-soft">
        <div className="flex min-h-[56px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-success to-success/75 text-success-foreground shadow-soft">
              <Apple className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-success">Next Meal</p>
              <p className="text-2xl font-bold leading-8 tracking-tight">
                {meal ? formatTime(meal.scheduled_time) : "—"}
              </p>
            </div>
          </div>
          {meal?.meal_type ? (
            <span className="shrink-0 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold capitalize text-success">
              {meal.meal_type}
            </span>
          ) : null}
        </div>

        {meal ? (
          <div className="mt-5 flex min-h-[48px] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{meal.meal_name}</p>
              <p className="text-sm text-muted-foreground">
                {meal.calories ?? "—"} cal · {meal.protein ?? "—"}g protein
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMeals}
              aria-label="Open meals"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-success text-success-foreground transition-opacity hover:opacity-90"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <EmptyInline label="No upcoming meal in your plan." />
        )}
      </section>

      {/* TODAY SUMMARY */}
      <section className="rounded-[24px] bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-ai to-ai/75 text-ai-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold tracking-tight">Today's Summary</h3>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Stat value={summary.workoutCount} label="Workout" />
          <Stat value={summary.mealCount} label="Meals" />
          <Stat value={summary.calories.toLocaleString()} label="Calories" />
        </div>
      </section>

      {/* AI TIP */}
      <section className="rounded-[24px] bg-gradient-to-br from-ai/10 to-primary/5 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-ai" />
          <div className="min-w-0">
            <p className="text-base font-semibold">AI Tip</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {tip?.tip_text ?? "No tip available for today."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold leading-8 tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyInline({ label }: { label: string }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Link to="/onboarding">
        <Button size="sm" variant="outline" className="mt-3 rounded-xl">
          Generate New Plan
        </Button>
      </Link>
    </div>
  );
}

// הקומפוננטה מציגה מצב ריק למשתמש שעוד אין לו תוכנית פעילה
function NoPlan() {
  return (
    <Card className="rounded-[24px] p-8 text-center shadow-soft">
      <Sparkles className="mx-auto h-8 w-8 text-ai" />
      <h3 className="mt-3 text-lg font-bold">No active plan yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your personalized AI plan to see your day at a glance.
      </p>
      <Link to="/onboarding">
        <Button className="mt-5 h-12 w-full rounded-2xl bg-cta-gradient font-bold text-primary-foreground">
          Generate New Plan
        </Button>
      </Link>
    </Card>
  );
}
