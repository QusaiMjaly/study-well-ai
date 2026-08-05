CREATE TABLE public.workout_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_day_id uuid NOT NULL REFERENCES public.workout_days(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  completed_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  completion_percentage integer NOT NULL DEFAULT 100,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX workout_completions_unique_exercise
  ON public.workout_completions (user_id, workout_day_id, exercise_id, completed_on)
  WHERE exercise_id IS NOT NULL;

CREATE UNIQUE INDEX workout_completions_unique_day
  ON public.workout_completions (user_id, workout_day_id, completed_on)
  WHERE exercise_id IS NULL;

CREATE INDEX workout_completions_lookup
  ON public.workout_completions (user_id, completed_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_completions TO authenticated;
GRANT ALL ON public.workout_completions TO service_role;

ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout completions"
ON public.workout_completions
FOR ALL
TO authenticated
USING (auth.uid() = user_id AND public.owns_workout_day(workout_day_id))
WITH CHECK (auth.uid() = user_id AND public.owns_workout_day(workout_day_id));