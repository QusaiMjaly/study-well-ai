import { supabase } from "@/integrations/supabase/client";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

/** Sniffs the real image type from the file bytes, independent of its filename. */
// הפונקציה מזהה את סוג התמונה האמיתי מתוך הבייטים של הקובץ, לא לפי שם הקובץ
async function sniffMime(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const is = (...sig: number[]) => sig.every((b, i) => head[i] === b);
  if (is(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (is(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (is(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  const ascii = String.fromCharCode(...head);
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.slice(4, 8) === "ftyp" && /hei[cf]|mif1|msf1/.test(ascii.slice(8, 12))) return "image/heic";
  return null;
}

/**
 * Uploads a timetable image under an ASCII-only, UUID based object path.
 *
 * The user's original filename (Hebrew, Arabic, emoji, spaces…) is never used
 * as the storage key — it is only kept for display.
 */
// הפונקציה מעלה תמונת מערכת שעות לאחסון תחת שם קובץ בטוח מבוסס UUID (בלי להשתמש בשם המקורי)
export async function uploadTimetableImage(file: File, userId: string) {
  const sniffed = await sniffMime(file);
  const mime = sniffed ?? (file.type.startsWith("image/") ? file.type : null);
  if (!mime) throw new Error("That file doesn't look like an image. Please upload a PNG or JPG.");

  const ext = EXT_BY_MIME[mime] ?? "png";
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${userId}/${uuid}.${ext}`;

  const { error } = await supabase.storage
    .from("schedule-images")
    .upload(path, file, { contentType: mime, upsert: false });
  if (error) throw error;

  return { path, mime, originalName: file.name };
}
