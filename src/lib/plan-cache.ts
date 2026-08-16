import type { QueryClient } from "@tanstack/react-query";

/**
 * Every cached read derived from the user's active AI plan.
 * Single source of truth so invalidation lists can't drift between screens.
 */
export const PLAN_QUERY_KEYS = [
  "active-plan",
  "today-meals",
  "today-workout",
  "progress-logs",
  "profile-bundle",
] as const;

/** Invalidate (and refetch active queries for) every plan-derived cache. */
export async function invalidatePlanCaches(qc: QueryClient) {
  await Promise.all(
    PLAN_QUERY_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })),
  );
}
