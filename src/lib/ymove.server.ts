// הקובץ הזה מכיל לקוח שרת-בלבד ל-API של YMove להבאת מטא-נתונים וסרטוני תרגילים, בלי לשמור אותם במסד.
/**
 * Server-only YMove Exercise API v2 client.
 * The API key never leaves this module, and provider video URLs are never persisted.
 */

const BASE_URL = "https://exercise-api.ymove.app/api/v2";

export type YmoveExercise = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  instructions?: string[];
  importantPoints?: string[];
  muscleGroup?: string | null;
  secondaryMuscles?: string[];
  equipment?: string | null;
  category?: string | null;
  difficulty?: string | null;
  hasVideo?: boolean;
  videoExcludedReason?: string | null;
  videos?: unknown;
};

// הפונקציה מחזירה את מפתח ה-API של YMove ומוודאת שהוא מוגדר בשרת
function apiKey() {
  const key = process.env["YMOVE_API_KEY"];
  if (!key) throw new Error("Exercise demo provider is not configured on the server.");
  return key;
}

// הפונקציה שולחת בקשה ל-API של YMove עם מפתח ה-API, בלי לחשוף פרטי שגיאה רגישים
async function ymoveFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey(), Accept: "application/json" },
  });

  if (!res.ok) {
    // Never surface the provider's raw body (may echo request headers).
    throw new Error(`Exercise demo provider returned ${res.status}.`);
  }
  return (await res.json()) as T;
}

/** Trial-safe catalogue browse/search. Never requests videos, so no allowance is consumed. */
// הפונקציה מביאה רשימת תרגילים מ-YMove לעיון בלבד, בלי סרטונים כדי לא לבזבז מכסה
export async function listYmoveExercises(opts: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const params: Record<string, string> = { includeVideos: "false" };
  if (opts.search) params["search"] = opts.search;
  if (opts.page) params["page"] = String(opts.page);
  if (opts.pageSize) params["pageSize"] = String(opts.pageSize);

  return ymoveFetch<{
    data: YmoveExercise[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  }>("/exercises", params);
}

/** Fetches one mapped exercise with fresh (temporary) video information. */
// הפונקציה מביאה תרגיל אחד מ-YMove, אופציונלית עם קישור סרטון זמני טרי
export async function getYmoveExercise(id: string, withVideos: boolean) {
  const payload = await ymoveFetch<{ data?: YmoveExercise } | YmoveExercise>(
    `/exercises/${encodeURIComponent(id)}`,
    withVideos ? { includeVideos: "true" } : { includeVideos: "false" },
  );
  const record = (payload as { data?: YmoveExercise }).data ?? (payload as YmoveExercise);
  return record ?? null;
}

/** Picks the first playable MP4/HLS URL out of the provider's videos payload. */
// הפונקציה בוחרת מתוך נתוני ה-YMove את קישור הסרטון הניתן לניגון הראשון
export function pickYmoveVideo(record: YmoveExercise): { url: string; poster: string | null } | null {
  const videos = record.videos as unknown;
  const candidates: any[] = Array.isArray(videos)
    ? videos
    : videos && typeof videos === "object"
      ? Object.values(videos as Record<string, unknown>)
      : [];

  for (const v of candidates) {
    if (!v) continue;
    if (typeof v === "string") return { url: v, poster: null };
    const url =
      v.url ?? v.mp4Url ?? v.mp4 ?? v.videoUrl ?? v.signedUrl ?? v.hlsUrl ?? v.hls ?? null;
    if (typeof url === "string" && url) {
      const poster = v.thumbnailUrl ?? v.posterUrl ?? v.thumbnail ?? null;
      return { url, poster: typeof poster === "string" ? poster : null };
    }
  }
  return null;
}
