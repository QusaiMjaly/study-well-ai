import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODEL = "openai/gpt-image-2";
const BUCKET = "meal-images";

export type MealImageResult = {
  status: "ready" | "unavailable";
  url?: string | null;
  /** Friendly reason when status is "unavailable". */
  message?: string;
  /** Transient failures may be retried later by the user. */
  retryable?: boolean;
};

// הפונקציה ממירה מחרוזת base64 לבייטים כדי לשמור את התמונה באחסון
function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Lazily generates (once) and returns a signed URL for a meal's plated dish image.
 * Never throws for generation problems — always returns a friendly result.
 */
// הפונקציה יוצרת פעם אחת תמונת AI של המנה ומחזירה קישור חתום; אם כבר קיימת — מחזירה את הקיימת
export const ensureMealImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mealItemId: string }) => {
    if (!d?.mealItemId || typeof d.mealItemId !== "string") throw new Error("Invalid meal");
    return d;
  })
  .handler(async ({ data, context }): Promise<MealImageResult> => {
    const { supabase, userId } = context;

    // Ownership is enforced by RLS (owns_meal_day) on this select.
    const { data: meal, error } = await supabase
      .from("meal_items")
      .select("id, meal_name, image_prompt, image_path, image_status")
      .eq("id", data.mealItemId)
      .maybeSingle();

    if (error || !meal) {
      return { status: "unavailable", message: "This meal could not be found.", retryable: false };
    }

    // Already generated -> fresh signed URL, no regeneration.
    if (meal.image_path && meal.image_status === "ready") {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(meal.image_path, 60 * 60);
      if (signed?.signedUrl) return { status: "ready", url: signed.signedUrl };
    }

    const prompt = (meal.image_prompt ?? "").trim();
    if (!prompt) {
      return {
        status: "unavailable",
        message: "No dish photo is available for this meal.",
        retryable: false,
      };
    }

    const key = process.env['LOVABLE_API_KEY'];
    if (!key) {
      return {
        status: "unavailable",
        message: "Meal photos aren't available right now.",
        retryable: true,
      };
    }

    await supabase.from("meal_items").update({ image_status: "generating" }).eq("id", meal.id);

    try {
      const res = await fetch(IMAGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: `${prompt}. Appetising food photography of the finished plated dish only. No people, no hands, no brand logos, no text or writing anywhere in the image. Natural lighting, 3/4 view.`,
          quality: "low",
          size: "1024x1024",
          n: 1,
        }),
      });

      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        await supabase
          .from("meal_items")
          .update({ image_status: retryable ? "none" : "failed" })
          .eq("id", meal.id);
        return {
          status: "unavailable",
          retryable,
          message: retryable
            ? "Photo generation is busy right now. Try again in a moment."
            : "A photo isn't available for this meal.",
        };
      }

      const json = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        await supabase.from("meal_items").update({ image_status: "none" }).eq("id", meal.id);
        return {
          status: "unavailable",
          retryable: true,
          message: "Photo generation didn't finish. Try again in a moment.",
        };
      }

      const path = `${userId}/${meal.id}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, b64ToBytes(b64), { contentType: "image/png", upsert: true });
      if (upErr) {
        await supabase.from("meal_items").update({ image_status: "none" }).eq("id", meal.id);
        return {
          status: "unavailable",
          retryable: true,
          message: "Couldn't save the photo. Try again in a moment.",
        };
      }

      await supabase
        .from("meal_items")
        .update({ image_path: path, image_status: "ready" })
        .eq("id", meal.id);

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60);
      return { status: "ready", url: signed?.signedUrl ?? null };
    } catch {
      await supabase.from("meal_items").update({ image_status: "none" }).eq("id", meal.id);
      return {
        status: "unavailable",
        retryable: true,
        message: "Couldn't create the photo right now. Try again later.",
      };
    }
  });
