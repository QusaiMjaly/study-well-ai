ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS exercise_slug text;

CREATE INDEX IF NOT EXISTS workout_exercises_slug_idx
  ON public.workout_exercises (exercise_slug);

CREATE TABLE public.exercise_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  category text,
  equipment text,
  animation_url text,
  poster_url text,
  primary_muscles text[] NOT NULL DEFAULT '{}',
  cues text[] NOT NULL DEFAULT '{}',
  common_mistakes text[] NOT NULL DEFAULT '{}',
  license text,
  attribution text,
  source_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX exercise_media_aliases_idx ON public.exercise_media USING gin (aliases);

GRANT SELECT ON public.exercise_media TO authenticated;
GRANT ALL    ON public.exercise_media TO service_role;

ALTER TABLE public.exercise_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active exercise media"
  ON public.exercise_media FOR SELECT TO authenticated
  USING (is_active);

CREATE TRIGGER update_exercise_media_updated_at
  BEFORE UPDATE ON public.exercise_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.exercise_media (slug, display_name, category, equipment, aliases) VALUES
  ('push_up','Push-Up','chest','bodyweight','{push up,pushup,press up}'),
  ('squat','Bodyweight Squat','legs','bodyweight','{air squat,body weight squat}'),
  ('bodyweight_lunge','Bodyweight Lunge','legs','bodyweight','{lunge,forward lunge,walking lunge}'),
  ('plank','Plank','core','bodyweight','{front plank,forearm plank}'),
  ('glute_bridge','Glute Bridge','legs','bodyweight','{hip bridge,bridge}'),
  ('mountain_climber','Mountain Climber','core','bodyweight','{mountain climbers}'),
  ('burpee','Burpee','full_body','bodyweight','{burpees}'),
  ('jumping_jack','Jumping Jack','cardio','bodyweight','{jumping jacks,star jump}'),
  ('crunch','Crunch','core','bodyweight','{crunches,abdominal crunch}'),
  ('sit_up','Sit-Up','core','bodyweight','{sit up,situp,sit-ups}'),
  ('bicycle_crunch','Bicycle Crunch','core','bodyweight','{bicycle crunches,bicycle kicks}'),
  ('russian_twist','Russian Twist','core','bodyweight','{russian twists}'),
  ('superman','Superman','back','bodyweight','{superman hold,back extension floor}'),
  ('dead_bug','Dead Bug','core','bodyweight','{deadbug}'),
  ('high_knees','High Knees','cardio','bodyweight','{high knee run}'),
  ('wall_sit','Wall Sit','legs','bodyweight','{wall squat hold}'),
  ('tricep_dip','Tricep Dip','arms','bodyweight','{bench dip,chair dip,dips}'),
  ('pull_up','Pull-Up','back','bodyweight','{pull up,pullup,chin up}'),
  ('dumbbell_bench_press','Dumbbell Bench Press','chest','dumbbell','{db bench press,flat dumbbell press}'),
  ('dumbbell_shoulder_press','Dumbbell Shoulder Press','shoulders','dumbbell','{db shoulder press,overhead dumbbell press}'),
  ('dumbbell_row','Dumbbell Row','back','dumbbell','{db row,one arm dumbbell row,bent over dumbbell row}'),
  ('bicep_curl','Bicep Curl','arms','dumbbell','{dumbbell curl,biceps curl}'),
  ('barbell_squat','Barbell Squat','legs','barbell','{back squat}'),
  ('deadlift','Deadlift','back','barbell','{conventional deadlift}'),
  ('lat_pulldown','Lat Pulldown','back','machine','{lat pull down,pulldown}'),
  ('leg_press','Leg Press','legs','machine','{machine leg press}'),
  ('treadmill_run','Treadmill Run','cardio','cardio','{treadmill,running,jog,jogging}'),
  ('stationary_bike','Stationary Bike','cardio','cardio','{exercise bike,cycling,spin bike}'),
  ('jump_rope','Jump Rope','cardio','bodyweight','{skipping,skipping rope}'),
  ('walking','Walking','cardio','cardio','{brisk walk,walk}'),
  ('incline_dumbbell_press','Incline Dumbbell Press','chest','dumbbell','{incline db press,incline dumbbell bench press}'),
  ('dumbbell_chest_fly','Dumbbell Chest Fly','chest','dumbbell','{chest fly,dumbbell fly,pec fly}'),
  ('lateral_raise','Lateral Raise','shoulders','dumbbell','{side raise,side lateral raise}'),
  ('front_raise','Front Raise','shoulders','dumbbell','{dumbbell front raise}'),
  ('rear_delt_fly','Rear Delt Fly','shoulders','dumbbell','{reverse fly,rear delt raise}'),
  ('seated_cable_row','Seated Cable Row','back','cable','{cable row,seated row}'),
  ('hammer_curl','Hammer Curl','arms','dumbbell','{hammer curls,neutral grip curl}'),
  ('tricep_pushdown','Tricep Pushdown','arms','cable','{triceps pushdown,cable pushdown,rope pushdown}'),
  ('overhead_tricep_extension','Overhead Tricep Extension','arms','dumbbell','{overhead triceps extension,french press}'),
  ('romanian_deadlift','Romanian Deadlift','legs','barbell','{rdl,stiff leg deadlift}'),
  ('leg_extension','Leg Extension','legs','machine','{quad extension}'),
  ('leg_curl','Leg Curl','legs','machine','{hamstring curl,lying leg curl}'),
  ('calf_raise','Calf Raise','legs','machine','{standing calf raise,calf raises}')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.save_ai_plan(_plan jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _plan_id uuid;
  _day jsonb;
  _child jsonb;
  _day_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.ai_plans SET is_active = false, updated_at = now()
  WHERE user_id = _uid AND is_active = true;

  INSERT INTO public.ai_plans (user_id, plan_name, is_active, ai_model, generation_version)
  VALUES (
    _uid,
    COALESCE(NULLIF(_plan->>'plan_name', ''), 'My AI Plan'),
    true,
    NULLIF(_plan->>'ai_model', ''),
    COALESCE((_plan->>'generation_version')::int, 1)
  )
  RETURNING id INTO _plan_id;

  FOR _day IN SELECT * FROM jsonb_array_elements(COALESCE(_plan->'workout_days', '[]'::jsonb))
  LOOP
    INSERT INTO public.workout_days (
      plan_id, day_name, workout_title, workout_type, duration_minutes,
      estimated_calories, scheduled_start, scheduled_end, notes
    ) VALUES (
      _plan_id,
      _day->>'day_name',
      _day->>'workout_title',
      _day->>'workout_type',
      NULLIF(_day->>'duration_minutes','')::int,
      NULLIF(_day->>'estimated_calories','')::int,
      NULLIF(_day->>'scheduled_start','')::time,
      NULLIF(_day->>'scheduled_end','')::time,
      _day->>'notes'
    ) RETURNING id INTO _day_id;

    FOR _child IN SELECT * FROM jsonb_array_elements(COALESCE(_day->'exercises', '[]'::jsonb))
    LOOP
      INSERT INTO public.workout_exercises (
        workout_day_id, exercise_order, exercise_name, sets, reps,
        duration_seconds, rest_seconds, notes, exercise_slug
      ) VALUES (
        _day_id,
        COALESCE(NULLIF(_child->>'exercise_order','')::int, 1),
        _child->>'exercise_name',
        NULLIF(_child->>'sets','')::int,
        _child->>'reps',
        NULLIF(_child->>'duration_seconds','')::int,
        NULLIF(_child->>'rest_seconds','')::int,
        _child->>'notes',
        (SELECT m.slug FROM public.exercise_media m
          WHERE m.slug = NULLIF(_child->>'exercise_slug','') AND m.is_active)
      );
    END LOOP;
  END LOOP;

  FOR _day IN SELECT * FROM jsonb_array_elements(COALESCE(_plan->'meal_days', '[]'::jsonb))
  LOOP
    INSERT INTO public.meal_days (
      plan_id, day_name, total_calories, protein, carbohydrates, fats
    ) VALUES (
      _plan_id,
      _day->>'day_name',
      NULLIF(_day->>'total_calories','')::int,
      NULLIF(_day->>'protein','')::numeric,
      NULLIF(_day->>'carbohydrates','')::numeric,
      NULLIF(_day->>'fats','')::numeric
    ) RETURNING id INTO _day_id;

    FOR _child IN SELECT * FROM jsonb_array_elements(COALESCE(_day->'meals', '[]'::jsonb))
    LOOP
      INSERT INTO public.meal_items (
        meal_day_id, meal_order, meal_name, meal_type, scheduled_time,
        calories, protein, carbohydrates, fats, ingredients, notes,
        preparation_steps, image_prompt
      ) VALUES (
        _day_id,
        COALESCE(NULLIF(_child->>'meal_order','')::int, 1),
        _child->>'meal_name',
        _child->>'meal_type',
        NULLIF(_child->>'scheduled_time','')::time,
        NULLIF(_child->>'calories','')::int,
        NULLIF(_child->>'protein','')::numeric,
        NULLIF(_child->>'carbohydrates','')::numeric,
        NULLIF(_child->>'fats','')::numeric,
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(COALESCE(_child->'ingredients', '[]'::jsonb))),
          '{}'::text[]
        ),
        _child->>'notes',
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(COALESCE(_child->'preparation_steps', '[]'::jsonb))),
          '{}'::text[]
        ),
        NULLIF(_child->>'image_prompt','')
      );
    END LOOP;
  END LOOP;

  FOR _child IN SELECT * FROM jsonb_array_elements(COALESCE(_plan->'daily_tips', '[]'::jsonb))
  LOOP
    INSERT INTO public.ai_daily_tips (plan_id, day_name, tip_text)
    VALUES (_plan_id, _child->>'day_name', _child->>'tip_text');
  END LOOP;

  RETURN _plan_id;
END;
$function$;