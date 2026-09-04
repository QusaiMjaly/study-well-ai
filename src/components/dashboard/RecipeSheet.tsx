import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChefHat, ImageOff, Loader2, RefreshCw, Sparkles, Utensils } from "lucide-react";
import { ensureMealImage, type MealImageResult } from "@/lib/meal-image.functions";
import type { MealItem } from "@/lib/meals-data";

export function RecipeSheet({
  meal,
  open,
  onOpenChange,
}: {
  meal: MealItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const getImage = useServerFn(ensureMealImage);
  const [image, setImage] = useState<MealImageResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (mealItemId: string) => {
    setLoading(true);
    try {
      const res = await getImage({ data: { mealItemId } });
      setImage(res);
    } catch {
      setImage({
        status: "unavailable",
        message: "Couldn't load the dish photo right now.",
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !meal) return;
    setImage(null);
    void load(meal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meal?.id]);

  const steps = meal?.preparation_steps ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[88vh] w-full max-w-[448px] overflow-y-auto rounded-t-3xl border-border/70 p-0"
      >
        <SheetHeader className="px-5 pb-2 pt-5 text-left">
          <SheetTitle className="text-[20px] font-bold leading-7">
            {meal?.meal_name ?? "Recipe"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-8">
          {/* Dish image */}
          <div className="overflow-hidden rounded-2xl bg-muted">
            {loading ? (
              <AiImageGenerating />
            ) : image?.status === "ready" && image.url ? (
              <img
                src={image.url}
                alt={`Plated ${meal?.meal_name ?? "meal"}`}
                loading="lazy"
                className="h-48 w-full object-cover"
              />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                <ImageOff className="h-7 w-7 text-muted-foreground" />
                <p className="text-[13px] text-muted-foreground">
                  {image?.message ?? "No photo available for this meal."}
                </p>
                {image?.retryable && meal ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 rounded-xl"
                    onClick={() => void load(meal.id)}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Try again
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          {/* Steps */}
          <section>
            <h3 className="flex items-center gap-2 text-[16px] font-bold">
              <ChefHat className="h-[18px] w-[18px] text-success" /> Preparation
            </h3>
            {steps.length ? (
              <ol className="mt-3 space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-[12px] font-bold text-success">
                      {i + 1}
                    </span>
                    <p className="text-[14px] leading-5 text-foreground/90">{s}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
                <Utensils className="h-4 w-4" />
                Preparation steps aren't available for this meal. Generate a new plan to get full
                recipes.
              </p>
            )}
          </section>

          {meal?.ingredients?.length ? (
            <section>
              <h3 className="text-[16px] font-bold">Ingredients</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {meal.ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-muted px-3 py-1.5 text-[12px] leading-4 text-muted-foreground"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {loading ? (
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing your dish photo…
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AiImageGenerating() {
  return (
    <div className="ai-shimmer relative flex h-48 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-ai/8 text-ai">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 motion-safe:animate-pulse" />
        <span className="text-sm font-semibold">Creating your meal image…</span>
      </div>
      <p className="text-xs text-ai/80">AI is generating a preview</p>
    </div>
  );
}
