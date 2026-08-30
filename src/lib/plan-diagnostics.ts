/**
 * Development-safe diagnostics for AI plan generation.
 *
 * Only non-sensitive, aggregate values are logged: never prompts, profile data,
 * schedule contents, API keys or provider media URLs.
 */

export type PlanDiagnostic =
  | { event: "candidates"; poolSize: number; families: number }
  | { event: "attempt"; attempt: number }
  | {
      event: "validation";
      attempt: number;
      passed: boolean;
      reason?: "invalid_json" | "schema" | "schedule" | "exercises";
      problemCount?: number;
    }
  | { event: "saved"; attempts: number; workoutDays: number; exercises: number };

function enabled() {
  return process.env["NODE_ENV"] !== "production";
}

export function logPlanDiagnostic(d: PlanDiagnostic) {
  if (!enabled()) return;
  // eslint-disable-next-line no-console
  console.info("[ai-plan]", JSON.stringify(d));
}
