ALTER TABLE public.exercise_media
ADD COLUMN ymove_exercise_id text;

ALTER TABLE public.exercise_media
ADD CONSTRAINT exercise_media_ymove_exercise_id_unique
UNIQUE (ymove_exercise_id);

COMMENT ON COLUMN public.exercise_media.ymove_exercise_id IS
  'Stable YMove exercise identifier. Identifies the exercise, never a temporary signed video URL.';