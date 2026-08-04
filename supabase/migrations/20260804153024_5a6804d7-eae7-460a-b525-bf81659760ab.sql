CREATE TABLE public.meal_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  meal_item_id uuid not null references public.meal_items(id) on delete cascade,
  completed_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (user_id, meal_item_id, completed_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_completions TO authenticated;
GRANT ALL ON public.meal_completions TO service_role;

ALTER TABLE public.meal_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal completions"
ON public.meal_completions FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.owns_meal_day((SELECT meal_day_id FROM public.meal_items WHERE id = meal_item_id)));

CREATE INDEX meal_completions_user_day_idx ON public.meal_completions (user_id, completed_on);