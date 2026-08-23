CREATE POLICY "Exercise media is publicly readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'exercise-media');

UPDATE public.exercise_media SET
  primary_muscles = '{chest,triceps,front deltoids,core}',
  cues = ARRAY[
    'Keep your body in a straight line from head to heels.',
    'Brace your core throughout the movement.',
    'Lower your chest under control.'],
  common_mistakes = ARRAY['Letting the hips sag.','Flaring the elbows excessively.']
WHERE slug = 'push_up';

UPDATE public.exercise_media SET
  primary_muscles = '{quadriceps,glutes,hamstrings,core}',
  cues = ARRAY[
    'Keep your chest up.',
    'Sit the hips back and down.',
    'Keep the knees tracking over the feet.'],
  common_mistakes = ARRAY['Knees collapsing inward.','Losing a neutral spine.']
WHERE slug = 'squat';

UPDATE public.exercise_media SET
  primary_muscles = '{chest,triceps,front deltoids}',
  cues = ARRAY[
    'Keep wrists stacked over the elbows.',
    'Lower the dumbbells to chest level under control.',
    'Keep shoulder blades pulled back into the bench.'],
  common_mistakes = ARRAY['Bouncing the weights at the bottom.','Letting the elbows flare to 90 degrees.']
WHERE slug = 'dumbbell_bench_press';

UPDATE public.exercise_media SET
  primary_muscles = '{lats,biceps,rear deltoids,upper back}',
  cues = ARRAY[
    'Pull the bar to the upper chest, not behind the neck.',
    'Lead with the elbows, not the hands.',
    'Control the bar back up fully.'],
  common_mistakes = ARRAY['Leaning far back and using momentum.','Shrugging the shoulders during the pull.']
WHERE slug = 'lat_pulldown';

UPDATE public.exercise_media SET
  primary_muscles = '{biceps,forearms}',
  cues = ARRAY[
    'Keep elbows tucked at your sides.',
    'Curl without swinging the torso.',
    'Lower the weight slowly.'],
  common_mistakes = ARRAY['Using the lower back to swing the weight.','Cutting the range of motion short.']
WHERE slug = 'bicep_curl';