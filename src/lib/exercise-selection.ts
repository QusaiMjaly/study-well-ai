/**
 * Server-side preselection of canonical StudentFitAI exercises for AI plan generation.
 *
 * Gemini never sees the whole catalogue: this module reduces the ~300 active
 * exercise_media rows to a balanced pool of roughly 60-120 candidates that fit
 * the student's goal, activity level and workout location preference.
 */

export type CatalogueRow = {
  slug: string;
  display_name: string;
  category: string | null;
  equipment: string | null;
  difficulty: string | null;
  primary_muscles: string[] | null;
  ymove_exercise_id?: string | null;
};

export type Candidate = {
  slug: string;
  name: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  family: MovementFamily;
};

export type SelectionContext = {
  goalType: string | null;
  activityLevel: string | null;
  workoutPreference: string | null;
  userId: string;
};

export const MOVEMENT_FAMILIES = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "calves",
  "core",
  "arms",
  "shoulders",
  "conditioning",
] as const;

export type MovementFamily = (typeof MOVEMENT_FAMILIES)[number];

/** Maps the normalized catalogue `category` values onto broad movement families. */
const CATEGORY_TO_FAMILY: Record<string, MovementFamily> = {
  horizontal_press: "horizontal_push",
  incline_press: "horizontal_push",
  decline_press: "horizontal_push",
  push_up: "horizontal_push",
  fly: "horizontal_push",
  pullover: "horizontal_push",
  chest: "horizontal_push",
  vertical_press: "vertical_push",
  dip: "vertical_push",
  shoulders: "shoulders",
  lateral_raise: "shoulders",
  front_raise: "shoulders",
  upright_row: "shoulders",
  rear_delt: "horizontal_pull",
  shrug: "horizontal_pull",
  horizontal_pull: "horizontal_pull",
  back: "horizontal_pull",
  vertical_pull: "vertical_pull",
  squat: "squat",
  leg_press: "squat",
  leg_extension: "squat",
  step_up: "lunge",
  lunge: "lunge",
  hinge: "hinge",
  bridge: "hinge",
  leg_curl: "hinge",
  abduction: "hinge",
  kickback: "arms",
  legs: "squat",
  calf_raise: "calves",
  core: "core",
  plank: "core",
  crunch: "core",
  sit_up: "core",
  rotation: "core",
  leg_raise: "core",
  antiextension: "core",
  carry: "core",
  curl: "arms",
  pushdown: "arms",
  extension: "arms",
  arms: "arms",
  conditioning: "conditioning",
  plyometric: "conditioning",
  cardio: "conditioning",
  full_body: "conditioning",
};

const HOME_EQUIPMENT = new Set(["bodyweight", "mat", "band"]);

type GoalBucket = "general" | "strength" | "endurance";

function goalBucket(goalType: string | null): GoalBucket {
  const g = (goalType ?? "").toLowerCase();
  if (/muscle|strength|gain|bulk/.test(g)) return "strength";
  if (/loss|lose|weight|endurance|cardio|fat|tone/.test(g)) return "endurance";
  return "general";
}

type Level = "beginner" | "typical" | "advanced";

function experienceLevel(activityLevel: string | null, goal: GoalBucket): Level {
  const a = (activityLevel ?? "").toLowerCase();
  if (!a || /sedentary|light|low|beginner/.test(a)) return "beginner";
  if (/very[_ -]?active|athlete|advanced/.test(a)) {
    return goal === "strength" ? "advanced" : "typical";
  }
  return "typical";
}

function allowedDifficulties(level: Level): string[] {
  if (level === "beginner") return ["beginner"];
  if (level === "typical") return ["beginner", "intermediate"];
  return ["beginner", "intermediate", "advanced"];
}

/** Difficulties we are willing to widen to when a family cannot be filled. */
function fallbackDifficulties(level: Level): string[] {
  if (level === "beginner") return ["beginner", "intermediate"];
  return allowedDifficulties(level);
}

const QUOTAS: Record<GoalBucket, Record<MovementFamily, number>> = {
  general: {
    horizontal_push: 8,
    vertical_push: 6,
    horizontal_pull: 8,
    vertical_pull: 5,
    squat: 8,
    hinge: 7,
    lunge: 7,
    calves: 3,
    core: 12,
    arms: 10,
    shoulders: 8,
    conditioning: 6,
  },
  strength: {
    horizontal_push: 10,
    vertical_push: 8,
    horizontal_pull: 10,
    vertical_pull: 7,
    squat: 10,
    hinge: 9,
    lunge: 8,
    calves: 4,
    core: 10,
    arms: 12,
    shoulders: 10,
    conditioning: 4,
  },
  endurance: {
    horizontal_push: 6,
    vertical_push: 4,
    horizontal_pull: 6,
    vertical_pull: 4,
    squat: 7,
    hinge: 5,
    lunge: 7,
    calves: 2,
    core: 12,
    arms: 6,
    shoulders: 5,
    conditioning: 12,
  },
};

const HOME_QUOTAS: Record<MovementFamily, number> = {
  horizontal_push: 4,
  vertical_push: 3,
  horizontal_pull: 3,
  vertical_pull: 2,
  squat: 4,
  hinge: 3,
  lunge: 4,
  calves: 2,
  core: 12,
  arms: 4,
  shoulders: 3,
  conditioning: 10,
};

export const MAX_CANDIDATES = 120;
export const MIN_CANDIDATES = 60;

/** Small deterministic string hash so a given user gets a stable but varied pool. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function toCandidate(row: CatalogueRow): Candidate | null {
  const family = CATEGORY_TO_FAMILY[(row.category ?? "").toLowerCase()];
  if (!family) return null;
  if (!row.slug || !row.display_name) return null;
  return {
    slug: row.slug,
    name: row.display_name,
    muscle: row.primary_muscles?.[0] ?? "full_body",
    equipment: row.equipment ?? "bodyweight",
    difficulty: row.difficulty ?? "beginner",
    family,
  };
}

/**
 * Reduces the active catalogue to a balanced candidate pool.
 * Deterministic for a given (catalogue, context) pair.
 */
export function selectCandidates(
  catalogue: CatalogueRow[],
  ctx: SelectionContext,
): Candidate[] {
  const goal = goalBucket(ctx.goalType);
  const level = experienceLevel(ctx.activityLevel, goal);
  const homeOnly = (ctx.workoutPreference ?? "").toLowerCase() === "home";

  const preferred = new Set(allowedDifficulties(level));
  const fallback = new Set(fallbackDifficulties(level));
  const quotas = homeOnly ? HOME_QUOTAS : QUOTAS[goal];

  const byFamily = new Map<MovementFamily, Candidate[]>();
  for (const row of catalogue) {
    const c = toCandidate(row);
    if (!c) continue;
    if (homeOnly && !HOME_EQUIPMENT.has(c.equipment)) continue;
    if (!fallback.has(c.difficulty)) continue;
    const list = byFamily.get(c.family) ?? [];
    list.push(c);
    byFamily.set(c.family, list);
  }

  const hasDemo = new Set(
    catalogue.filter((r) => r.ymove_exercise_id).map((r) => r.slug),
  );

  const picked: Candidate[] = [];
  for (const family of MOVEMENT_FAMILIES) {
    const pool = byFamily.get(family) ?? [];
    const ranked = [...pool].sort((a, b) => {
      const diff = Number(!preferred.has(a.difficulty)) - Number(!preferred.has(b.difficulty));
      if (diff !== 0) return diff;
      const demo = Number(!hasDemo.has(a.slug)) - Number(!hasDemo.has(b.slug));
      if (demo !== 0) return demo;
      return hash(ctx.userId + a.slug) - hash(ctx.userId + b.slug);
    });
    picked.push(...ranked.slice(0, quotas[family]));
  }

  if (picked.length > MAX_CANDIDATES) {
    // Trim from the largest families first so balance is preserved.
    const counts = new Map<MovementFamily, number>();
    for (const c of picked) counts.set(c.family, (counts.get(c.family) ?? 0) + 1);
    const trimmed = [...picked];
    while (trimmed.length > MAX_CANDIDATES) {
      let biggest: MovementFamily = MOVEMENT_FAMILIES[0];
      for (const f of MOVEMENT_FAMILIES) {
        if ((counts.get(f) ?? 0) > (counts.get(biggest) ?? 0)) biggest = f;
      }
      const idx = trimmed.map((c) => c.family).lastIndexOf(biggest);
      if (idx < 0) break;
      trimmed.splice(idx, 1);
      counts.set(biggest, (counts.get(biggest) ?? 0) - 1);
    }
    return trimmed;
  }

  return picked;
}

/** Compact prompt block: only the fields Gemini needs to choose an exercise. */
export function formatCandidatesForPrompt(candidates: Candidate[]): string {
  const header = "slug | name | muscle | equipment | difficulty | family";
  const rows = candidates.map(
    (c) => `${c.slug} | ${c.name} | ${c.muscle} | ${c.equipment} | ${c.difficulty} | ${c.family}`,
  );
  return [header, ...rows].join("\n");
}
