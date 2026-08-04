ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS workout_preference text,
  ADD COLUMN IF NOT EXISTS meal_preference text,
  ADD COLUMN IF NOT EXISTS workout_duration text,
  ADD COLUMN IF NOT EXISTS preferred_time text,
  ADD COLUMN IF NOT EXISTS biggest_challenge text;