import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Check, Clock, Sparkles, Utensils } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/dashboard-data";
import { fetchTodayMeals, setMealCompleted, type MealItem } from "@/lib/meals-data";

export function MealsPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
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
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="flex items-start gap-3 rounded-2xl border-destructive/30 p-5">
        <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <h3 className="font-semibold">Couldn't load your meals</h3>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="rounded-2xl p-10 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 font-semibold">No active plan yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your personalized AI plan to see your meals.
        </p>
        <Link to="/onboarding">
          <Button className="mt-4">Generate New Plan</Button>
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
  });

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Today's Meal Plan</h2>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
          <Sparkles className="mr-1 h-3 w-3" /> AI Personalized
        </Badge>
      </div>

      {/* DAILY PROGRESS */}
      <Card className="rounded-2xl p-5">
        <h3 className="text-sm font-medium text-muted-foreground">Daily progress</h3>
        <div className="mt-4 space-y-4">
          <ProgressRow
            label="Calories"
            value={Math.round(consumedCalories)}
            target={data.targetCalories}
            unit="kcal"
          />
          <ProgressRow
            label="Protein"
            value={Math.round(consumedProtein)}
            target={data.targetProtein}
            unit="g"
          />
        </div>
      </Card>

      {/* MEAL CARDS */}
      {data.meals.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center">
          <Utensils className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 font-semibold">No meals scheduled for today</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your plan has no meals for {data.dayName}.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value} / {target} {unit}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
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
    <Card className={`rounded-2xl p-5 ${done ? "bg-primary/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{meal.meal_name}</h3>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{meal.meal_type ?? "Meal"}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(meal.scheduled_time)}
            </span>
          </p>
        </div>
        <Badge variant={done ? "default" : "secondary"} className="rounded-full">
          {done ? "Completed" : "Pending"}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Macro value={meal.calories} label="kcal" />
        <Macro value={meal.protein} label="protein (g)" />
        <Macro value={meal.carbohydrates} label="carbs (g)" />
        <Macro value={meal.fats} label="fats (g)" />
      </div>

      {meal.ingredients?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {meal.ingredients.map((ing, i) => (
            <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {ing}
            </span>
          ))}
        </div>
      ) : null}

      {meal.notes ? <p className="mt-3 text-xs text-muted-foreground">{meal.notes}</p> : null}

      <Button
        onClick={onToggle}
        disabled={busy}
        variant={done ? "outline" : "default"}
        className="mt-4 w-full rounded-xl"
      >
        {done ? (
          <>
            <Check className="mr-2 h-4 w-4" /> Completed — undo
          </>
        ) : (
          "Mark as completed"
        )}
      </Button>
    </Card>
  );
}

function Macro({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <div className="text-base font-semibold">{value ?? "—"}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
