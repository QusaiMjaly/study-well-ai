ALTER TABLE public.meal_items
  ADD COLUMN IF NOT EXISTS preparation_steps text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS image_prompt text,
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'none';

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
        duration_seconds, rest_seconds, notes
      ) VALUES (
        _day_id,
        COALESCE(NULLIF(_child->>'exercise_order','')::int, 1),
        _child->>'exercise_name',
        NULLIF(_child->>'sets','')::int,
        _child->>'reps',
        NULLIF(_child->>'duration_seconds','')::int,
        NULLIF(_child->>'rest_seconds','')::int,
        _child->>'notes'
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