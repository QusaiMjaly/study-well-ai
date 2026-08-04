REVOKE EXECUTE ON FUNCTION public.owns_ai_plan(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_workout_day(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owns_meal_day(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owns_ai_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_workout_day(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_meal_day(uuid) TO authenticated;