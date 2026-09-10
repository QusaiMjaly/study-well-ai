// הקובץ הזה מספק קומפוננטה גלובלית לניהול מחזור יצירת התוכנית מחדש — מצב, מניעת כפילות ושמירה על בקשה בין מעברי עמודים.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { generateAiPlan } from "@/lib/plan.functions";
import { invalidatePlanCaches } from "@/lib/plan-cache";
import { friendlyMessage } from "@/lib/friendly-errors";

export type RegenerationStatus = "idle" | "generating" | "success" | "failed";

type PlanRegenerationValue = {
  status: RegenerationStatus;
  isGenerating: boolean;
  /** True only after a genuine generation failure (never after navigation). */
  hasFailed: boolean;
  /** Starts a regeneration unless one is already in flight. Resolves when done. */
  requestRegeneration: (options?: { reason?: string }) => Promise<boolean>;
  clearFailure: () => void;
};

const PlanRegenerationContext = createContext<PlanRegenerationValue | null>(null);

/**
 * Owns the AI plan regeneration lifecycle for the whole authenticated app.
 *
 * Mounted above every /app page so SPA navigation can never cancel an
 * in-flight regeneration or turn it into a failure. Uses the existing
 * `generateAiPlan` server function — there is no second generation path.
 */
// הקומפוננטה מנהלת באופן גלובלי את תהליך יצירת התוכנית מחדש, גם בזמן מעבר בין עמודים
export function PlanRegenerationProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const generate = useServerFn(generateAiPlan);
  const [status, setStatus] = useState<RegenerationStatus>("idle");
  /** Duplicate-generation guard that survives re-renders and route changes. */
  const inFlight = useRef<Promise<boolean> | null>(null);

  // הפונקציה מבקשת יצירת תוכנית מחדש ומוודאת שלא רצה יצירה כפולה במקביל
  const requestRegeneration = useCallback(
    (options?: { reason?: string }) => {
      if (inFlight.current) return inFlight.current;

      setStatus("generating");
      const run = (async () => {
        try {
          await generate(undefined as never);
          await invalidatePlanCaches(qc);
          setStatus("success");
          toast.success(
            options?.reason === "schedule"
              ? "Your plan was updated for the new schedule."
              : "Your plan was updated",
          );
          return true;
        } catch (e) {
          setStatus("failed");
          toast.error(
            friendlyMessage(e, "Your details were saved, but we couldn't refresh your plan yet."),
          );
          return false;
        } finally {
          inFlight.current = null;
        }
      })();

      inFlight.current = run;
      return run;
    },
    [generate, qc],
  );

  // הפונקציה מנקה את מצב הכישלון אחרי שהמשתמש ראה אותו
  const clearFailure = useCallback(() => {
    setStatus((s) => (s === "failed" ? "idle" : s));
  }, []);

  const value = useMemo<PlanRegenerationValue>(
    () => ({
      status,
      isGenerating: status === "generating",
      hasFailed: status === "failed",
      requestRegeneration,
      clearFailure,
    }),
    [status, requestRegeneration, clearFailure],
  );

  return (
    <PlanRegenerationContext.Provider value={value}>{children}</PlanRegenerationContext.Provider>
  );
}

// ה-Hook נותן לקומפוננטות גישה למצב יצירת התוכנית מחדש ולבקשת יצירה
export function usePlanRegeneration() {
  const ctx = useContext(PlanRegenerationContext);
  if (!ctx) {
    throw new Error("usePlanRegeneration must be used inside PlanRegenerationProvider");
  }
  return ctx;
}
