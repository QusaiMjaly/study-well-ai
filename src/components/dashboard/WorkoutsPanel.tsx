import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  Check,
  Clock,
  Flame,
  Leaf,
  Sparkles,
  Target,
  Timer,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/dashboard-data";
import {
  fetchTodayWorkout,
  setExerciseCompleted,
  setWorkoutCompleted,
  type TodayWorkout,
  type WorkoutExercise,
} from "@/lib/workouts-data";
import { DataError } from "@/components/dashboard/DataError";
import { friendlyMessage } from "@/lib/friendly-errors";
import { ExerciseDemoSheet } from "@/components/dashboard/ExerciseDemoSheet";

export function WorkoutsPanel() {
  const qc = useQueryClient();
  const [demo, setDemo] = useState<WorkoutExercise | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
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
    onError: (e) => toast.error(friendlyMessage(e)),
  });

  const toggleWorkout = useMutation({
    mutationFn: ({ completed, pct }: { completed: boolean; pct: number }) =>
      setWorkoutCompleted(data!.workoutDayId, completed, pct),
    onSuccess: (_r, v) => {
      refresh();
      if (v.completed) toast.success("Workout completed 💪");
    },
    onError: (e) => toast.error(friendlyMessage(e)),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[212px] w-full rounded-3xl" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[86px] w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <DataError title="Couldn't load your workout" error={error} onRetry={() => refetch()} />
    );
  }


  if (!data)
    return (
      <EmptyCard
        title="No active plan yet"
        body="Your personalized AI plan will appear here once it's ready."
      />
    );

  if (!data.workoutDayId) {
    return <RecoveryDay data={data} />;
  }

  const total = data.exercises.length;
  const done = data.completedExerciseIds.length;
  const pct = total ? Math.round((done / total) * 100) : data.dayCompleted ? 100 : 0;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <section className="bg-workout-gradient rounded-3xl px-6 pb-6 pt-6 text-primary-foreground shadow-card">
        <div className="flex items-center gap-2 text-[14px] font-medium">
          <Sparkles className="h-[18px] w-[18px]" />
          AI Optimized
        </div>
        <h2 className="mt-3 text-[24px] font-bold leading-8">
          {data.workoutTitle ?? "Today's Workout"}
        </h2>
        <p className="mt-1 text-[14px] opacity-85">
          {data.workoutType ?? "Training"} • {formatTime(data.scheduledStart)}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <HeaderStat
            icon={<Clock className="h-[18px] w-[18px]" />}
            value={`${data.durationMinutes ?? "—"} min`}
            label="Duration"
          />
          <HeaderStat
            icon={<Flame className="h-[18px] w-[18px]" />}
            value={`${data.estimatedCalories ?? "—"}`}
            label="Calories"
          />
          <HeaderStat
            icon={<Target className="h-[18px] w-[18px]" />}
            value={`${done}/${total || 0}`}
            label="Complete"
          />
        </div>
      </section>

      {/* EXERCISES */}
      {total === 0 ? (
        <EmptyCard title="No exercises listed" body="This workout has no exercises in your plan." />
      ) : (
        <div className="space-y-3">
          {data.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              completed={data.completedExerciseIds.includes(ex.id)}
              disabled={toggleExercise.isPending}
              onToggle={(completed) => toggleExercise.mutate({ id: ex.id, completed })}
              onViewDemo={() => setDemo(ex)}
            />
          ))}
        </div>
      )}

      {/* PROGRESS + PRIMARY ACTION */}
      <Card className="gap-0 rounded-2xl border-border/70 p-4 shadow-soft">
        <div className="flex items-center justify-between text-[14px]">
          <span className="font-semibold">Workout progress</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-muted-foreground">
          <span>{done} completed</span>
          <span>{Math.max(total - done, 0)} remaining</span>
        </div>
      </Card>

      <Button
        variant="ghost"
        className={`h-14 w-full rounded-2xl text-[16px] font-semibold ${
          data.dayCompleted
            ? "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90"
        }`}
        disabled={toggleWorkout.isPending}
        onClick={() => toggleWorkout.mutate({ completed: !data.dayCompleted, pct })}
      >
        {data.dayCompleted ? (
          <>
            <Check className="mr-2 h-5 w-5" /> Workout Completed
          </>
        ) : (
          "Complete Workout"
        )}
      </Button>
    </div>
  );
}

function HeaderStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-white/15 px-2 py-3 text-center">
      <div className="flex justify-center opacity-90">{icon}</div>
      <div className="mt-1.5 text-[14px] font-bold">{value}</div>
      <div className="text-[12px] opacity-80">{label}</div>
    </div>
  );
}

function ExerciseCard({
  ex,
  completed,
  disabled,
  onToggle,
  onViewDemo,
}: {
  ex: WorkoutExercise;
  completed: boolean;
  disabled: boolean;
  onToggle: (completed: boolean) => void;
  onViewDemo: () => void;
}) {
  return (
    <Card
      className={`gap-0 rounded-2xl border p-4 shadow-soft transition-colors ${
        completed ? "border-success/40 bg-success/5" : "border-border/70"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
            completed ? "bg-success text-success-foreground" : "bg-primary/10 text-primary"
          }`}
        >
          {completed ? <Check className="h-5 w-5" /> : ex.exercise_order}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-bold leading-5">{ex.exercise_name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
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
        </div>

        <button
          type="button"
          aria-label={completed ? "Mark exercise as pending" : "Mark exercise as done"}
          disabled={disabled}
          onClick={() => onToggle(!completed)}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
            completed
              ? "bg-success/12 text-success hover:bg-success/20"
              : "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90"
          }`}
        >
          <Check className="h-[18px] w-[18px]" />
        </button>
      </div>

      {ex.notes ? (
        <p className="mt-2.5 pl-13 text-[12px] leading-4 text-muted-foreground">{ex.notes}</p>
      ) : null}

      <button
        type="button"
        onClick={onViewDemo}
        className="mt-2.5 ml-13 flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <PlayCircle className="h-4 w-4" /> View demo
      </button>
    </Card>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-2xl p-10 text-center shadow-soft">
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
      <section className="bg-meals-gradient rounded-3xl px-6 py-7 text-center text-success-foreground shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <Leaf className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-[24px] font-bold leading-8">🌿 Recovery Day</h2>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-5 opacity-90">
          Recovery is an essential part of your personalized AI training plan. Today is intentionally
          reserved to help your body recover and prepare for the next workout.
        </p>
      </section>

      <Card className="gap-0 rounded-2xl border-border/70 p-4 shadow-soft">
        <h3 className="text-[16px] font-bold">Recovery goals</h3>
        <ul className="mt-3 space-y-2.5">
          {RECOVERY_GOALS.map((g) => (
            <li key={g} className="flex items-center gap-2.5 text-[14px] text-muted-foreground">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/12">
                <Check className="h-3.5 w-3.5 text-success" />
              </span>
              {g}
            </li>
          ))}
        </ul>
      </Card>

      {next ? (
        <Card className="gap-0 rounded-2xl border-border/70 p-4 shadow-soft">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" /> Next workout
          </div>
          <h3 className="mt-2 text-[18px] font-bold leading-6">{next.workoutTitle ?? "Workout"}</h3>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {next.workoutType ?? "Training"} • {next.dayName} • {formatTime(next.scheduledStart)}
          </p>

          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-primary/8 px-2 py-2.5 text-center">
              <div className="text-[12px] font-medium text-muted-foreground">Duration</div>
              <div className="mt-0.5 text-[16px] font-bold text-primary">
                {next.durationMinutes ?? "—"} min
              </div>
            </div>
            <div className="rounded-xl bg-warning/10 px-2 py-2.5 text-center">
              <div className="text-[12px] font-medium text-muted-foreground">Calories</div>
              <div className="mt-0.5 text-[16px] font-bold text-warning">
                {next.estimatedCalories ?? "—"}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            className="mt-4 h-12 w-full rounded-2xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
            onClick={() => setShowNext((v) => !v)}
          >
            {showNext ? "Hide Next Workout" : "View Next Workout"}
          </Button>

          {showNext ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              {next.notes ? (
                <p className="text-[13px] leading-5 text-muted-foreground">{next.notes}</p>
              ) : null}
              {next.exercises.map((ex) => (
                <div key={ex.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary">
                    {ex.exercise_order}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold leading-5">{ex.exercise_name}</p>
                    <div className="flex flex-wrap gap-x-3 text-[12px] text-muted-foreground">
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
        <Card className="rounded-2xl p-5 text-center text-[14px] text-muted-foreground shadow-soft">
          Enjoy the rest — no further workouts are scheduled in your current plan week.
        </Card>
      )}
    </div>
  );
}
