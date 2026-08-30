import { Loader2 } from "lucide-react";
import { usePlanRegeneration } from "@/lib/plan-regeneration";

/**
 * Small app-level status shown while a plan regeneration runs, on any page.
 * Non-blocking: it floats above the content and never replaces page UI.
 */
export function PlanRegenerationBanner() {
  const { isGenerating } = usePlanRegeneration();
  if (!isGenerating) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-ai/30 bg-ai/10 px-4 py-2.5 text-sm font-medium shadow-soft backdrop-blur">
        <Loader2 className="h-4 w-4 animate-spin text-ai" />
        Updating your plan…
      </div>
    </div>
  );
}
