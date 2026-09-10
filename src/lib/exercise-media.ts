// הקובץ הזה מוצא בצד הלקוח את נתוני המדיה של תרגיל לפי ה-slug או שם תואם מהקטלוג.
import { supabase } from "@/integrations/supabase/client";

export type ExerciseMedia = {
  slug: string;
  display_name: string;
  category: string | null;
  equipment: string | null;
  animation_url: string | null;
  poster_url: string | null;
  primary_muscles: string[];
  cues: string[];
  common_mistakes: string[];
  license: string | null;
  attribution: string | null;
  source_url: string | null;
};

const COLUMNS =
  "slug, display_name, category, equipment, animation_url, poster_url, primary_muscles, cues, common_mistakes, license, attribution, source_url";

/** Normalizes a free-text exercise name for safe alias comparison. */
// הפונקציה מנרמלת שם תרגיל בטקסט חופשי כדי שאפשר יהיה להשוות אותו בבטחה
export function normalizeExerciseName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Resolves demo media for one exercise.
 * 1. Exact canonical slug stored on the plan row (authoritative).
 * 2. Legacy plans only: exact alias / display-name match on the normalized name.
 * Never guesses — an unmatched exercise returns null so the UI shows a text-only state.
 */
// הפונקציה מוצאת את נתוני המדיה של תרגיל לפי ה-slug השמור או לפי התאמת שם מדויקת
export async function fetchExerciseMedia(
  slug: string | null | undefined,
  exerciseName: string,
): Promise<ExerciseMedia | null> {
  if (slug) {
    const { data, error } = await supabase
      .from("exercise_media")
      .select(COLUMNS)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ExerciseMedia;
  }

  const normalized = normalizeExerciseName(exerciseName);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("exercise_media")
    .select(`${COLUMNS}, aliases`)
    .eq("is_active", true);
  if (error) throw error;

  const match = (data ?? []).find((row: any) => {
    if (normalizeExerciseName(row.display_name) === normalized) return true;
    if (normalizeExerciseName(row.slug) === normalized) return true;
    return (row.aliases ?? []).some((a: string) => normalizeExerciseName(a) === normalized);
  });

  return (match as ExerciseMedia | undefined) ?? null;
}
