// הקובץ הזה מוצא סרטון הדגמה לתרגיל — קודם מ-YMove, אחר כך מנכס עצמי, ואם אין — מסמן כלא זמין.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeExerciseName } from "./exercise-media";

export type ExerciseDemoDto = {
  source: "ymove" | "self" | "none";
  slug: string | null;
  display_name: string;
  category: string | null;
  equipment: string | null;
  primary_muscles: string[];
  cues: string[];
  common_mistakes: string[];
  video: { url: string; poster: string | null } | null;
  /** Set when metadata exists but no playable video is available. */
  video_unavailable: boolean;
  license: string | null;
  attribution: string | null;
  source_url: string | null;
};

const COLUMNS =
  "slug, display_name, category, equipment, animation_url, poster_url, primary_muscles, cues, common_mistakes, license, attribution, source_url, ymove_exercise_id, aliases";

/**
 * Resolves demo media for one exercise, server-side.
 * Priority: mapped YMove demo -> self-hosted licensed asset -> unavailable state.
 * No fuzzy YMove matching happens here; only the stored ymove_exercise_id is used.
 */
// הפונקציה מוצאת ומחזירה את סרטון ההדגמה של תרגיל, קודם מ-YMove ואם לא — מנכס עצמי
export const getExerciseDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug?: string | null; exerciseName: string }) => ({
    slug: input.slug ?? null,
    exerciseName: String(input.exerciseName ?? ""),
  }))
  .handler(async ({ data, context }): Promise<ExerciseDemoDto | null> => {
    const { supabase } = context;

    let row: any = null;
    if (data.slug) {
      const { data: r, error } = await supabase
        .from("exercise_media")
        .select(COLUMNS)
        .eq("slug", data.slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      row = r;
    }

    if (!row) {
      const normalized = normalizeExerciseName(data.exerciseName);
      if (!normalized) return null;
      const { data: rows, error } = await supabase
        .from("exercise_media")
        .select(COLUMNS)
        .eq("is_active", true);
      if (error) throw error;
      row =
        (rows ?? []).find(
          (r: any) =>
            normalizeExerciseName(r.display_name) === normalized ||
            normalizeExerciseName(r.slug) === normalized ||
            (r.aliases ?? []).some((a: string) => normalizeExerciseName(a) === normalized),
        ) ?? null;
    }

    if (!row) return null;

    const base: ExerciseDemoDto = {
      source: "none",
      slug: row.slug,
      display_name: row.display_name,
      category: row.category,
      equipment: row.equipment,
      primary_muscles: row.primary_muscles ?? [],
      cues: row.cues ?? [],
      common_mistakes: row.common_mistakes ?? [],
      video: null,
      video_unavailable: false,
      license: row.license,
      attribution: row.attribution,
      source_url: row.source_url,
    };

    if (row.ymove_exercise_id) {
      try {
        const { getYmoveExercise, pickYmoveVideo } = await import("./ymove.server");
        const record = await getYmoveExercise(row.ymove_exercise_id, true);
        if (record) {
          const video = pickYmoveVideo(record);
          return {
            ...base,
            source: "ymove",
            display_name: base.display_name || record.title,
            equipment: base.equipment ?? record.equipment ?? null,
            category: base.category ?? record.category ?? null,
            primary_muscles: base.primary_muscles.length
              ? base.primary_muscles
              : [record.muscleGroup, ...(record.secondaryMuscles ?? [])].filter(
                  (m): m is string => !!m,
                ),
            cues: base.cues.length ? base.cues : (record.instructions ?? []),
            common_mistakes: base.common_mistakes.length
              ? base.common_mistakes
              : (record.importantPoints ?? []),
            video,
            video_unavailable: !video,
          };
        }
      } catch {
        // Provider unreachable — fall through to the self-hosted asset.
      }
    }

    if (row.animation_url || row.poster_url) {
      return {
        ...base,
        source: "self",
        video: row.animation_url ? { url: row.animation_url, poster: row.poster_url } : null,
        video_unavailable: !row.animation_url,
      };
    }

    return { ...base, video_unavailable: true };
  });

/** Read-only catalogue browse used for establishing mappings. Never requests videos. */
// הפונקציה מאפשרת לעיין בקטלוג YMove לצורך מיפוי תרגילים, בלי לבקש סרטונים בפועל
export const searchYmoveCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; page?: number; pageSize?: number }) => input ?? {})
  .handler(async ({ data }) => {
    const { listYmoveExercises } = await import("./ymove.server");
    const res = await listYmoveExercises({
      ...(data.search ? { search: data.search } : {}),
      ...(data.page ? { page: data.page } : {}),
      pageSize: data.pageSize ?? 20,
    });
    return {
      pagination: res.pagination ?? null,
      items: (res.data ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        equipment: e.equipment ?? null,
        category: e.category ?? null,
        muscleGroup: e.muscleGroup ?? null,
        difficulty: e.difficulty ?? null,
        hasVideo: !!e.hasVideo,
      })),
    };
  });
