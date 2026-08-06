import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Check, Clock, Dumbbell, Flame, Sparkles, Timer } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/dashboard-data";
import {
  fetchTodayWorkout,
  setExerciseCompleted,
  setWorkoutCompleted,
  type WorkoutExercise,
} from "@/lib/workouts-data";

export function WorkoutsPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["today-workout"],
    queryFn: () => fetchTodayWorkout(),
    staleTime: 60_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["today-workout"] });
    qc.invalidateQueries({ queryKey: ["active-plan"] });
    qc.invalidateQueries({ queryKey: ["progress-logs"] });
  };

  const toggleExercise = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      setExerciseCompleted(data!.workoutDayId, id, completed),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleWorkout = useMutation({
    mutationFn: ({ completed, pct }: { completed: boolean; pct: number }) =>
      setWorkoutCompleted(data!.workoutDayId, completed, pct),
    onSuccess: (_r, v) => {
      refresh();
      if (v.completed) toast.success("Workout completed 💪");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="flex items-start gap-3 rounded-2xl border-destructive/30 p-5">
        <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <h3 className="font-semibold">Couldn't load your workout</h3>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </Card>
    );
  }

  if (!data) return <EmptyCard title="No active plan yet" body="Your personalized AI plan will appear here once it's ready." />;

  if (!data.workoutDayId) {
    return <RecoveryDay data={data} />;
  }


  const total = data.exercises.length;
  const done = data.completedExerciseIds.length;
  const pct = total ? Math.round((done / total) * 100) : data.dayCompleted ? 100 : 0;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Dumbbell className="h-4 w-4 text-primary" /> Today's Workout
            </div>
            <h2 className="mt-2 text-xl font-bold">{data.workoutTitle ?? "Workout"}</h2>
            <p className="text-sm text-muted-foreground">
              {data.workoutType ?? "Training"} · {formatTime(data.scheduledStart)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="h-3 w-3" /> AI Optimized
            </Badge>
            <Badge variant={data.dayCompleted ? "default" : "secondary"}>
              {data.dayCompleted ? "Completed" : "Pending"}
            </Badge>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Clock className="h-4 w-4" />} value={`${data.durationMinutes ?? "—"} min`} label="Duration" />
          <Stat icon={<Flame className="h-4 w-4" />} value={`${data.estimatedCalories ?? "—"}`} label="kcal burn" />
          <Stat value={`${data.workoutNumber}`} label="Workout #" />
          <Stat value={`${data.weeklyWorkoutCount}`} label="This week" />
        </div>

        {data.notes ? <p className="mt-4 text-sm text-muted-foreground">{data.notes}</p> : null}
      </Card>

      {/* PROGRESS */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Workout progress</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="mt-3" />
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>{done} completed</span>
          <span>{Math.max(total - done, 0)} remaining</span>
        </div>
        <Button
          className="mt-4 w-full"
          variant={data.dayCompleted ? "outline" : "default"}
          disabled={toggleWorkout.isPending}
          onClick={() => toggleWorkout.mutate({ completed: !data.dayCompleted, pct })}
        >
          {data.dayCompleted ? "Mark workout as pending" : "Complete workout"}
        </Button>
      </Card>

      {/* EXERCISES */}
      {total === 0 ? (
        <EmptyCard title="No exercises listed" body="This workout has no exercises in your plan." />
      ) : (
        data.exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            completed={data.completedExerciseIds.includes(ex.id)}
            disabled={toggleExercise.isPending}
            onToggle={(completed) => toggleExercise.mutate({ id: ex.id, completed })}
          />
        ))
      )}
    </div>
  );
}

function ExerciseCard({
  ex,
  completed,
  disabled,
  onToggle,
}: {
  ex: WorkoutExercise;
  completed: boolean;
  disabled: boolean;
  onToggle: (completed: boolean) => void;
}) {
  return (
    <Card className={`rounded-2xl p-5 ${completed ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {ex.exercise_order}
          </div>
          <div>
            <h3 className="font-semibold">{ex.exercise_name}</h3>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {ex.sets ? <span>{ex.sets} sets</span> : null}
              {ex.reps ? <span>{ex.reps} reps</span> : null}
              {ex.duration_seconds ? (
                <span className="flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  {ex.duration_seconds}s
                </span>
              ) : null}
              {ex.rest_seconds ? <span>{ex.rest_seconds}s rest</span> : null}
            </div>
            {ex.notes ? <p className="mt-2 text-xs text-muted-foreground">{ex.notes}</p> : null}
          </div>
        </div>
        <Button
          size="sm"
          variant={completed ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onToggle(!completed)}
        >
          <Check className="mr-1 h-4 w-4" />
          {completed ? "Done" : "Mark"}
        </Button>
      </div>
    </Card>
  );
}

function Stat({ icon, value, label }: { icon?: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-lg font-bold">
        {icon}
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-2xl p-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Card>
  );
}

const RECOVERY_GOALS = ["Stay hydrated", "Get enough sleep", "Light stretching", "Optional light walk"];

function RecoveryDay({ data }: { data: NonNullable<TodayWorkout> }) {
  const [showNext, setShowNext] = useState(false);
  const next = data.nextWorkout;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-primary/20 bg-primary/5 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Leaf className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-3 text-xl font-bold">🌿 Recovery Day</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Recovery is an essential part of your personalized AI training plan. Today is intentionally
          reserved to help your body recover and prepare for the next workout.
        </p>
      </Card>

      <Card className="rounded-2xl p-5">
        <h3 className="font-semibold">Recovery goals</h3>
        <ul className="mt-3 space-y-2">
          {RECOVERY_GOALS.map((g) => (
            <li key={g} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-primary" />
              {g}
            </li>
          ))}
        </ul>
      </Card>

      {next ? (
        <Card className="rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" /> Next workout
          </div>
          <h3 className="mt-2 text-lg font-bold">{next.workoutTitle ?? "Workout"}</h3>
          <p className="text-sm text-muted-foreground">
            {next.workoutType ?? "Training"} · {next.dayName} · {formatTime(next.scheduledStart)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat icon={<Clock className="h-4 w-4" />} value={`${next.durationMinutes ?? "—"} min`} label="Duration" />
            <Stat icon={<Flame className="h-4 w-4" />} value={`${next.estimatedCalories ?? "—"}`} label="kcal burn" />
          </div>

          <Button className="mt-4 w-full" onClick={() => setShowNext((v) => !v)}>
            {showNext ? "Hide Next Workout" : "View Next Workout"}
          </Button>

          {showNext ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              {next.notes ? <p className="text-sm text-muted-foreground">{next.notes}</p> : null}
              {next.exercises.map((ex) => (
                <div key={ex.id} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {ex.exercise_order}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ex.exercise_name}</p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {ex.sets ? <span>{ex.sets} sets</span> : null}
                      {ex.reps ? <span>{ex.reps} reps</span> : null}
                      {ex.duration_seconds ? <span>{ex.duration_seconds}s</span> : null}
                      {ex.rest_seconds ? <span>{ex.rest_seconds}s rest</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="rounded-2xl p-5 text-center text-sm text-muted-foreground">
          Enjoy the rest — no further workouts are scheduled in your current plan week.
        </Card>
      )}
    </div>
  );
}
