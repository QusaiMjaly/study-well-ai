import { supabase } from "@/integrations/supabase/client";
import { DAY_NAMES, dayIndexOf, normalizeDay, todayIndex } from "@/lib/day-utils";
import { localDateKey } from "@/lib/meals-data";

export type WorkoutExercise = {
  id: string;
  exercise_order: number;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercise_slug?: string | null;
};

export type NextWorkout = {
  workoutDayId: string;
  dayName: string;
  workoutTitle: string | null;
  workoutType: string | null;
  durationMinutes: number | null;
  estimatedCalories: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  notes: string | null;
  exercises: WorkoutExercise[];
  /** Days from today until this workout. */
  daysAway: number;
};

export type TodayWorkout = {
  planId: string;
  dayName: string;
  workoutDayId: string;
  workoutTitle: string | null;
  workoutType: string | null;
  durationMinutes: number | null;
  estimatedCalories: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  notes: string | null;
  exercises: WorkoutExercise[];
  /** 1-based index of today's workout among the week's workout days. */
  workoutNumber: number;
  weeklyWorkoutCount: number;
  completedExerciseIds: string[];
  dayCompleted: boolean;
  /** Nearest upcoming workout (used on recovery days). */
  nextWorkout: NextWorkout | null;
} | null;

const DAYS = DAY_NAMES;
const DAY_INDEX = (name: string) => dayIndexOf(name);


/** One optimized read: active plan -> this week's workout days + today's exercises, plus today's completions. */
export async function fetchTodayWorkout(now = new Date()): Promise<TodayWorkout> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const { data, error } = await supabase
    .from("ai_plans")
    .select(
      `id,
       workout_days ( id, day_name, workout_title, workout_type, duration_minutes, estimated_calories, scheduled_start, scheduled_end, notes,
         workout_exercises ( id, exercise_order, exercise_name, sets, reps, duration_seconds, rest_seconds, notes ) )`,
    )
    .eq("user_id", u.user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const allDays = ((data.workout_days ?? []) as any[]).slice().sort(
    (a, b) => DAY_INDEX(a.day_name) - DAY_INDEX(b.day_name),
  );
  const today = normalizeDay(DAYS[todayIndex(now)]);
  const idx = allDays.findIndex((d) => normalizeDay(d.day_name) === today);
  const day = idx >= 0 ? allDays[idx] : null;

  /** Scan forward from today (wrapping across the week) for the nearest workout. */
  const findNext = (): NextWorkout | null => {
    const todayIdx = todayIndex(now);
    for (let offset = 1; offset <= 7; offset++) {
      const target = (todayIdx + offset) % 7;
      const match = allDays.find((d) => DAY_INDEX(d.day_name) === target);
      if (match) {
        return {
          workoutDayId: match.id,
          dayName: DAYS[target]!,
          workoutTitle: match.workout_title,
          workoutType: match.workout_type,
          durationMinutes: match.duration_minutes,
          estimatedCalories: match.estimated_calories,
          scheduledStart: match.scheduled_start,
          scheduledEnd: match.scheduled_end,
          notes: match.notes,
          exercises: ((match.workout_exercises ?? []) as WorkoutExercise[])
            .slice()
            .sort((a, b) => a.exercise_order - b.exercise_order),
          daysAway: offset,
        };
      }
    }
    return null;
  };

  if (!day) {
    return {
      planId: data.id,
      dayName: DAYS[todayIndex(now)]!,
      workoutDayId: "",
      workoutTitle: null,
      workoutType: null,
      durationMinutes: null,
      estimatedCalories: null,
      scheduledStart: null,
      scheduledEnd: null,
      notes: null,
      exercises: [],
      workoutNumber: 0,
      weeklyWorkoutCount: allDays.length,
      completedExerciseIds: [],
      dayCompleted: false,
      nextWorkout: findNext(),
    };
  }


  const exercises = ((day.workout_exercises ?? []) as WorkoutExercise[])
    .slice()
    .sort((a, b) => a.exercise_order - b.exercise_order);

  const { data: comps, error: cErr } = await supabase
    .from("workout_completions")
    .select("exercise_id")
    .eq("user_id", u.user.id)
    .eq("workout_day_id", day.id)
    .eq("completed_on", localDateKey(now));
  if (cErr) throw cErr;

  return {
    planId: data.id,
    dayName: DAYS[todayIndex(now)]!,
    workoutDayId: day.id,
    workoutTitle: day.workout_title,
    workoutType: day.workout_type,
    durationMinutes: day.duration_minutes,
    estimatedCalories: day.estimated_calories,
    scheduledStart: day.scheduled_start,
    scheduledEnd: day.scheduled_end,
    notes: day.notes,
    exercises,
    workoutNumber: idx + 1,
    weeklyWorkoutCount: allDays.length,
    completedExerciseIds: (comps ?? []).filter((c) => c.exercise_id).map((c) => c.exercise_id!),
    dayCompleted: (comps ?? []).some((c) => !c.exercise_id),
    nextWorkout: findNext(),

  };
}

export async function setExerciseCompleted(
  workoutDayId: string,
  exerciseId: string,
  completed: boolean,
  now = new Date(),
) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const completed_on = localDateKey(now);

  if (completed) {
    const { error } = await supabase.from("workout_completions").insert({
      user_id: u.user.id,
      workout_day_id: workoutDayId,
      exercise_id: exerciseId,
      completed_on,
      completion_percentage: 100,
    });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("workout_completions")
      .delete()
      .eq("user_id", u.user.id)
      .eq("workout_day_id", workoutDayId)
      .eq("exercise_id", exerciseId)
      .eq("completed_on", completed_on);
    if (error) throw error;
  }
}

/** Marks (or clears) the whole workout for today. Stored as the exercise_id IS NULL row. */
export async function setWorkoutCompleted(
  workoutDayId: string,
  completed: boolean,
  percentage: number,
  now = new Date(),
) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const completed_on = localDateKey(now);

  if (completed) {
    const { error } = await supabase.from("workout_completions").insert({
      user_id: u.user.id,
      workout_day_id: workoutDayId,
      exercise_id: null,
      completed_on,
      completion_percentage: Math.round(percentage),
    });
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("workout_completions")
      .delete()
      .eq("user_id", u.user.id)
      .eq("workout_day_id", workoutDayId)
      .is("exercise_id", null)
      .eq("completed_on", completed_on);
    if (error) throw error;
  }
}
