/**
 * Compact candidate pools for single-exercise replacement.
 *
 * The full plan generator uses selectCandidates(); a replacement only needs a
 * small pool around the exercise being swapped, so this module ranks the active
 * catalogue by movement family, muscle overlap, equipment context and difficulty.
 */
import { toCandidate, type Candidate, type CatalogueRow, type MovementFamily } from "./exercise-selection";

export const REPLACEMENT_POOL_SIZE = 24;
export const LOOKUP_POOL_SIZE = 40;

const HOME_EQUIPMENT = new Set(["bodyweight", "mat", "band"]);
const HOME_ELIGIBLE_SLUGS = new Set(["walking", "jump_rope"]);

/** Families that can reasonably cover for one another. */
const COMPATIBLE: Partial<Record<MovementFamily, MovementFamily[]>> = {
  horizontal_push: ["vertical_push", "shoulders", "arms"],
  vertical_push: ["horizontal_push", "shoulders"],
  horizontal_pull: ["vertical_pull", "arms"],
  vertical_pull: ["horizontal_pull", "arms"],
  squat: ["lunge", "hinge"],
  hinge: ["squat", "lunge"],
  lunge: ["squat", "hinge"],
  calves: ["lunge", "conditioning"],
  core: ["conditioning"],
  arms: ["horizontal_push", "horizontal_pull"],
  shoulders: ["vertical_push", "arms"],
  conditioning: ["core", "lunge"],
};

// הפונקציה הופכת שורות מהקטלוג לרשימת מועמדים תקינים בלבד
export function toCandidates(rows: CatalogueRow[]): Candidate[] {
  return rows.map(toCandidate).filter((c): c is Candidate => c !== null);
}

// הפונקציה בודקת אם אפשר לבצע את התרגיל באימון ביתי
export function isHomeCompatible(c: Candidate) {
  return HOME_EQUIPMENT.has(c.equipment.toLowerCase()) || HOME_ELIGIBLE_SLUGS.has(c.slug);
}

// הפונקציה בודקת אם רמת הפעילות של הסטודנט מתירה תרגילים מתקדמים
export function allowsAdvanced(activityLevel: string | null) {
  return /very|athlete|advanced/.test((activityLevel ?? "").toLowerCase());
}

export type PoolContext = {
  workoutPreference: string | null;
  activityLevel: string | null;
  /** Slugs already used in this workout day (never offered again). */
  excludeSlugs: string[];
  originalSlug: string | null;
};

/** Slugs that fit the student's current training context (home/gym + difficulty). */
// הפונקציה מסננת תרגילים שמתאימים להקשר של הסטודנט (בית/חדר כושר ורמת קושי)
export function contextCompatible(all: Candidate[], ctx: PoolContext): Candidate[] {
  const home = (ctx.workoutPreference ?? "").toLowerCase() === "home";
  const advanced = allowsAdvanced(ctx.activityLevel);
  return all.filter((c) => {
    if (home && !isHomeCompatible(c)) return false;
    if (!advanced && c.difficulty.toLowerCase() === "advanced") return false;
    return true;
  });
}

/**
 * Ranked replacement pool: same family first, then muscle overlap, then
 * compatible families. Excludes the original and everything already programmed.
 */
// הפונקציה בונה מאגר תרגילי חלופה מדורגים לתרגיל שהמשתמש רוצה להחליף
export function buildReplacementPool(
  all: Candidate[],
  original: Candidate | null,
  ctx: PoolContext,
  limit = REPLACEMENT_POOL_SIZE,
): Candidate[] {
  const excluded = new Set([...ctx.excludeSlugs, ...(ctx.originalSlug ? [ctx.originalSlug] : [])]);
  const eligible = contextCompatible(all, ctx).filter((c) => !excluded.has(c.slug));

  const compatible = new Set(original ? (COMPATIBLE[original.family] ?? []) : []);
  const score = (c: Candidate) => {
    if (!original) return 1;
    let s = 0;
    if (c.family === original.family) s += 4;
    else if (compatible.has(c.family)) s += 2;
    if (c.muscle && c.muscle === original.muscle) s += 3;
    if (c.difficulty === original.difficulty) s += 1;
    return s;
  };

  return eligible
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/**
 * Name search across the WHOLE active catalogue, so a specific request is never
 * declared missing just because it is outside the context-compatible pool.
 */
// הפונקציה מחפשת תרגילים בקטלוג לפי שם חופשי שהמשתמש הקליד
export function searchCatalogue(all: Candidate[], query: string, limit = LOOKUP_POOL_SIZE) {
  const q = tokens(query);
  if (!q.length) return [];
  return all
    .map((c) => {
      const name = tokens(`${c.name} ${c.slug}`);
      let s = 0;
      for (const t of q) {
        if (name.includes(t)) s += 3;
        else if (name.some((n) => n.startsWith(t) || t.startsWith(n))) s += 1;
      }
      return { c, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

/** Merges pools, keeping order and removing duplicates. */
// הפונקציה ממזגת כמה מאגרי תרגילים לאחד, בלי כפילויות
export function mergePools(...pools: Candidate[][]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const pool of pools) {
    for (const c of pool) {
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      out.push(c);
    }
  }
  return out;
}
