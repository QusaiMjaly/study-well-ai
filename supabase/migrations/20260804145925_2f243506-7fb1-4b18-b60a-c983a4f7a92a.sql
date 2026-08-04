-- =========================
-- ai_plans
-- =========================
CREATE TABLE public.ai_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name text NOT NULL DEFAULT 'My AI Plan',
  is_active boolean NOT NULL DEFAULT true,
  ai_model text,
  generation_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_plans TO authenticated;
GRANT ALL ON public.ai_plans TO service_role;
ALTER TABLE public.ai_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai plans"
  ON public.ai_plans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_plans_user_created ON public.ai_plans (user_id, created_at DESC);
CREATE UNIQUE INDEX idx_ai_plans_one_active ON public.ai_plans (user_id) WHERE is_active;

-- =========================
-- ownership helpers (security definer, avoids recursive RLS)
-- =========================
CREATE OR REPLACE FUNCTION public.owns_ai_plan(_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ai_plans p WHERE p.id = _plan_id AND p.user_id = auth.uid());
$$;

-- =========================
-- workout_days
-- =========================
CREATE TABLE public.workout_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.ai_plans(id) ON DELETE CASCADE,
  day_name text NOT NULL CHECK (day_name IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
  workout_title text,
  workout_type text,
  duration_minutes integer,
  estimated_calories integer,
  scheduled_start time,
  scheduled_end time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_days TO authenticated;
GRANT ALL ON public.workout_days TO service_role;
ALTER TABLE public.workout_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout days"
  ON public.workout_days FOR ALL TO authenticated
  USING (public.owns_ai_plan(plan_id)) WITH CHECK (public.owns_ai_plan(plan_id));

CREATE INDEX idx_workout_days_plan ON public.workout_days (plan_id);

CREATE OR REPLACE FUNCTION public.owns_workout_day(_day_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workout_days d
    JOIN public.ai_plans p ON p.id = d.plan_id
    WHERE d.id = _day_id AND p.user_id = auth.uid()
  );
$$;

-- =========================
-- workout_exercises
-- =========================
CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id uuid NOT NULL REFERENCES public.workout_days(id) ON DELETE CASCADE,
  exercise_order integer NOT NULL DEFAULT 1,
  exercise_name text NOT NULL,
  sets integer,
  reps text,
  duration_seconds integer,
  rest_seconds integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout exercises"
  ON public.workout_exercises FOR ALL TO authenticated
  USING (public.owns_workout_day(workout_day_id)) WITH CHECK (public.owns_workout_day(workout_day_id));

CREATE INDEX idx_workout_exercises_day_order ON public.workout_exercises (workout_day_id, exercise_order);

-- =========================
-- meal_days
-- =========================
CREATE TABLE public.meal_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.ai_plans(id) ON DELETE CASCADE,
  day_name text NOT NULL CHECK (day_name IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
  total_calories integer,
  protein numeric,
  carbohydrates numeric,
  fats numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_days TO authenticated;
GRANT ALL ON public.meal_days TO service_role;
ALTER TABLE public.meal_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal days"
  ON public.meal_days FOR ALL TO authenticated
  USING (public.owns_ai_plan(plan_id)) WITH CHECK (public.owns_ai_plan(plan_id));

CREATE INDEX idx_meal_days_plan ON public.meal_days (plan_id);

CREATE OR REPLACE FUNCTION public.owns_meal_day(_day_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meal_days d
    JOIN public.ai_plans p ON p.id = d.plan_id
    WHERE d.id = _day_id AND p.user_id = auth.uid()
  );
$$;

-- =========================
-- meal_items
-- =========================
CREATE TABLE public.meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_day_id uuid NOT NULL REFERENCES public.meal_days(id) ON DELETE CASCADE,
  meal_order integer NOT NULL DEFAULT 1,
  meal_name text NOT NULL,
  meal_type text,
  scheduled_time time,
  calories integer,
  protein numeric,
  carbohydrates numeric,
  fats numeric,
  ingredients text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_items TO authenticated;
GRANT ALL ON public.meal_items TO service_role;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal items"
  ON public.meal_items FOR ALL TO authenticated
  USING (public.owns_meal_day(meal_day_id)) WITH CHECK (public.owns_meal_day(meal_day_id));

CREATE INDEX idx_meal_items_day_order ON public.meal_items (meal_day_id, meal_order);

-- =========================
-- ai_daily_tips
-- =========================
CREATE TABLE public.ai_daily_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.ai_plans(id) ON DELETE CASCADE,
  day_name text NOT NULL CHECK (day_name IN ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
  tip_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_daily_tips TO authenticated;
GRANT ALL ON public.ai_daily_tips TO service_role;
ALTER TABLE public.ai_daily_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai daily tips"
  ON public.ai_daily_tips FOR ALL TO authenticated
  USING (public.owns_ai_plan(plan_id)) WITH CHECK (public.owns_ai_plan(plan_id));

CREATE INDEX idx_ai_daily_tips_plan_day ON public.ai_daily_tips (plan_id, day_name);

-- =========================
-- progress_logs
-- =========================
CREATE TABLE public.progress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight numeric,
  body_fat numeric,
  muscle_mass numeric,
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_logs TO authenticated;
GRANT ALL ON public.progress_logs TO service_role;
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress logs"
  ON public.progress_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_progress_logs_user_logged ON public.progress_logs (user_id, logged_at DESC);

-- =========================
-- updated_at trigger for ai_plans
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_ai_plans_updated_at
  BEFORE UPDATE ON public.ai_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();