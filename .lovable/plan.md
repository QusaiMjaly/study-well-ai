# Stage: Curated catalogue → AI workout generation (design only)

## 1. What exists today

- `src/lib/plan-prompt.ts` — hardcoded `CANONICAL_EXERCISE_SLUGS` array of the **old 43 slugs**, injected as a flat "SUPPORTED EXERCISE SLUGS" list. Rule currently says: use a slug only if accurate, otherwise `exercise_slug: null`.
- `src/lib/plan-schema.ts` — `ExerciseSchema.exercise_slug` is `string | null` (nullable, no enum check). `validatePlanAgainstSchedule()` covers workout/meal timing only; **no slug validation at all today**.
- `src/lib/plan.functions.ts` — `generateAiPlan` loads profile/goals/schedule, loops max 2 attempts (`buildPlanPrompt(inputs, problems)`), validates shape then schedule, saves via `save_ai_plan`.
- `save_ai_plan` RPC already resolves `exercise_slug` against `exercise_media` where `is_active`, storing NULL if unknown — safe, no change needed.

## 2. Catalogue gap found (blocking, needs a small migration)

The curated catalogue was inserted, but `exercise_media` **has no `difficulty` column**, so the approved beginner/intermediate/advanced values (154 / 154 / 1) were never persisted. Preselection rule #3 cannot work without it.

Also, the 43 legacy rows carry body-part `category` values (`legs`, `arms`, `core`, `chest`, `cardio`…) instead of movement families, and 42 of them have empty or legacy `primary_muscles`. The 254 curated rows have normalized family + muscles. Mixed taxonomy breaks family-balanced preselection.

**Proposed smallest safe migration** (separate approval, applied before implementation):
1. `ALTER TABLE public.exercise_media ADD COLUMN difficulty text` (nullable, no constraint change elsewhere).
2. Backfill `difficulty` for all 297 rows from the approved curated dataset; legacy-only rows (`superman`, `treadmill_run`, `stationary_bike`, `walking`, `jump_rope`) get `beginner`.
3. Normalize only the legacy 43 rows' `category` → approved movement family and `primary_muscles` → approved muscle vocabulary. No slug renames, no deletes, no YMove ID changes, no new rows.

Nothing else in the schema or RPC needs to change.

## 3. Preselection algorithm (new `src/lib/exercise-selection.ts`)

Pure function `selectCandidates(catalogue, ctx)` — server-side only, no AI involved.

Input context from data we already have: `goal_type`, `activity_level`, `workout_preference`, `workout_duration`, `age`. No equipment field is invented; equipment is derived from `workout_preference` exactly as the prompt already does:

| workout_preference | allowed equipment |
|---|---|
| `home` | bodyweight, mat, band |
| `gym` / `no_preference` / null | all (bodyweight, mat, band, dumbbell, barbell, machine, cable, kettlebell, bench, cardio, other) |

Difficulty gate:
- beginner goal signals (`activity_level` sedentary/light, or age-unknown default) → `beginner` only, plus `intermediate` fill if a family is short.
- typical user (moderate/active) → `beginner` + `intermediate`.
- `advanced` → only when `activity_level = very_active` **and** goal is strength/muscle. Never for beginners.

Family-balanced quota fill (deterministic, seeded shuffle per user id so pools are stable per user but varied across users). Per-family caps, goal-weighted:

```text
family            general  strength/muscle  weight_loss/endurance  home-only
horizontal_push      8            10                  6              4
vertical_push        6             8                  4              3
horizontal_pull      8            10                  6              3
vertical_pull        5             7                  4              2
squat                8            10                  7              4
hinge                7             9                  5              3
lunge/single-leg     7             8                  7              4
calves               3             4                  2              2
core (+plank/crunch/rotation/leg_raise/antiextension) 12  10          12              12
arms (curl/pushdown/extension/kickback/dip)          10  12            6              4
shoulders (lateral/front/rear_delt/shrug/upright)     8  10            5              3
conditioning/cardio/plyometric                        6   4           12              10
```

Within each family, ranking is: difficulty match → equipment match to preference → prefer YMove-mapped (demo available) → compound before isolation → stable hash. Cap total at 120, floor at 60; if a family cannot be filled at the target difficulty, widen one difficulty step for that family only.

The 5 non-YMove exercises stay fully eligible (`walking`, `treadmill_run`, `stationary_bike` in the cardio family; `jump_rope` conditioning; `superman` core) — they just rank slightly below mapped ones.

### Example pool (hypothetical user)

Female, 20, 62 kg, activity `light`, goal `weight_loss`, preference `home`, duration `30`:

- Difficulty: beginner only (intermediate fill allowed)
- Equipment: bodyweight, mat, band
- Pool size: 68 exercises

```text
squat (4)            squat, wall_sit, bodyweight_split_squat, prisoner_squat
lunge (4)            bodyweight_lunge, reverse_lunge, step_up, curtsy_lunge
hinge (3)            glute_bridge, single_leg_glute_bridge, good_morning_bodyweight
horizontal_push (4)  push_up, knee_push_up, incline_push_up, wide_push_up
vertical_push (3)    pike_push_up, wall_handstand_hold, band_shoulder_press
horizontal_pull (3)  band_row, inverted_row, band_face_pull
vertical_pull (2)    band_lat_pulldown, pull_up
core (12)            plank, side_plank, dead_bug, crunch, bicycle_crunch, sit_up,
                     russian_twist, leg_raise, flutter_kick, hollow_hold,
                     superman, bird_dog
calves (2)           calf_raise, single_leg_calf_raise
conditioning (10)    jumping_jack, high_knees, mountain_climber, burpee,
                     jump_rope, walking, squat_jump, skater_hop,
                     butt_kicks, shadow_box
arms (4)             tricep_dip, bench_dip, band_curl, diamond_push_up
shoulders (3)        lateral_raise_band, front_raise_band, rear_delt_band_pull
```

## 4. Prompt change (`plan-prompt.ts`)

`CANONICAL_EXERCISE_SLUGS` is deleted. `buildPlanPrompt` gains a `candidates` argument and renders a compact table — slug, name, muscle, equipment, difficulty, family only. No UUIDs, URLs, provider titles, instructions, importantPoints, aliases.

```text
ALLOWED EXERCISE CATALOGUE (choose exercise_slug ONLY from this list)
slug | name | muscle | equipment | difficulty | family
push_up | Push-Up | chest | bodyweight | beginner | horizontal_push
incline_push_up | Incline Push-Up | chest | bodyweight | beginner | horizontal_push
band_row | Resistance Band Row | back | band | beginner | horizontal_pull
glute_bridge | Glute Bridge | glutes | bodyweight | beginner | hinge
...
```

Hard rule replacing the current line 87:

> Every exercise MUST include `"exercise_slug"` and it MUST be copied exactly from the ALLOWED EXERCISE CATALOGUE above. Never invent, modify or omit a slug, and never use a slug that is not listed. `"exercise_name"` must be the display name of that same exercise. Build a well-structured program — you do not need to use every listed exercise or every movement family.

At ~90 candidates × ~70 chars this adds roughly 6 KB to the prompt — acceptable.

## 5. Post-generation validation

New `validatePlanExercises(plan, allowedSlugs)` in `plan-schema.ts`, run in `plan.functions.ts` immediately after the Zod parse and alongside the schedule validation, against **the candidate set used for that generation** (not the global 297):

- `exercise_slug` null/missing → problem
- slug not in candidate set → problem, listed by name
- duplicate exercise within one workout day → problem

Failures feed the existing 2-attempt retry loop with explicit correction text:

```text
Use only exercise_slug values from the provided allowed exercise catalogue.
Invalid slugs in your last attempt: dumbbell_thruster, cable_woodchopper.
```

No silent substitution, no fuzzy remapping. If both attempts fail, the existing error is thrown and nothing is saved.

Schema note: `exercise_slug` stays nullable in Zod for backward compatibility with stored plans; the new business validation is what enforces non-null on generation.

## 6. Files touched (implementation stage)

| File | Change |
|---|---|
| migration (separate approval) | add `difficulty`, backfill, normalize 43 legacy rows |
| `src/lib/exercise-selection.ts` | **new** — pure preselection algorithm + types |
| `src/lib/plan-prompt.ts` | drop hardcoded slug list, accept candidates, new catalogue block + hard rule |
| `src/lib/plan-schema.ts` | add `validatePlanExercises()` |
| `src/lib/plan.functions.ts` | load active catalogue, run preselection, pass candidates, validate slugs in retry loop |

Unchanged: `save_ai_plan`, meals, schedule parsing, YMove demo architecture, `exercise-demo.functions.ts`, `ExerciseDemoSheet.tsx`, plan DB schema.
