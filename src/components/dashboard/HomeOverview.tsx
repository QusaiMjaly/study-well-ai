import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dumbbell, Apple, Sparkles, Flame, Clock, AlertCircle } from "lucide-react";
import {
  fetchActivePlan,
  pickNextWorkout,
  pickNextMeal,
  todaySummary,
  todayTip,
  formatTime,
} from "@/lib/dashboard-data";

export function HomeOverview() {
  const { data: plan, isLoading, isError, error } = useQuery({
    queryKey: ["active-plan"],
    queryFn: fetchActivePlan,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="space-y-3 rounded-2xl p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-36" />
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mb-8 flex items-start gap-3 rounded-2xl border-destructive/30 p-5">
        <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <h3 className="font-semibold">Couldn't load your plan</h3>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </Card>
    );
  }

  if (!plan) return <NoPlan />;

  const workout = pickNextWorkout(plan);
  const meal = pickNextMeal(plan);
  const summary = todaySummary(plan);
  const tip = todayTip(plan);

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2">
      {/* NEXT WORKOUT */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Dumbbell className="h-4 w-4 text-primary" /> Next workout
        </div>
        {workout ? (
          <>
            <h3 className="mt-2 text-lg font-semibold">{workout.workout_title ?? workout.workout_type ?? "Workout"}</h3>
            <p className="text-sm text-muted-foreground">
              {workout.day_name} · {formatTime(workout.scheduled_start)}
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-muted-foreground" />{workout.duration_minutes ?? "—"} min</span>
              <span className="flex items-center gap-1"><Flame className="h-4 w-4 text-muted-foreground" />{workout.estimated_calories ?? "—"} kcal</span>
            </div>
          </>
        ) : (
          <EmptyInline label="No upcoming workout in your plan." />
        )}
      </Card>

      {/* NEXT MEAL */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Apple className="h-4 w-4 text-primary" /> Next meal
        </div>
        {meal ? (
          <>
            <h3 className="mt-2 text-lg font-semibold">{meal.meal_name}</h3>
            <p className="text-sm text-muted-foreground">
              {meal.meal_type ?? "Meal"} · {formatTime(meal.scheduled_time)}
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <span>{meal.calories ?? "—"} kcal</span>
              <span>{meal.protein ?? "—"} g protein</span>
            </div>
          </>
        ) : (
          <EmptyInline label="No upcoming meal in your plan." />
        )}
      </Card>

      {/* TODAY SUMMARY */}
      <Card className="rounded-2xl p-5">
        <div className="text-sm font-medium text-muted-foreground">Today</div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Stat value={summary.workoutCount} label="Workouts" />
          <Stat value={summary.mealCount} label="Meals" />
          <Stat value={summary.calories} label="kcal" />
          <Stat value={`${summary.protein}g`} label="Protein" />
        </div>
      </Card>

      {/* AI TIP */}
      <Card className="rounded-2xl bg-primary/5 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" /> AI tip of the day
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {tip?.tip_text ?? "No tip available for today."}
        </p>
      </Card>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyInline({ label }: { label: string }) {
  return (
    <div className="mt-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Link to="/onboarding">
        <Button size="sm" variant="outline" className="mt-3">Generate New Plan</Button>
      </Link>
    </div>
  );
}

function NoPlan() {
  return (
    <Card className="mb-8 rounded-2xl p-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 font-semibold">No active plan yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your personalized AI plan to see your day at a glance.
      </p>
      <Link to="/onboarding">
        <Button className="mt-4">Generate New Plan</Button>
      </Link>
    </Card>
  );
}
