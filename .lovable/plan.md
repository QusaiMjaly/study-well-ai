# Auto-regenerate the plan when plan-relevant details change

Design only — nothing implemented yet.

## 1. Current save flow

`ProfilePanel` loads one `profile-bundle` query (`fetchProfileBundle`). Editing seeds a local `form`
from stored values. Save runs a single mutation:

```text
validateEdits(form) -> saveProfileEdits(bundle, form)
   profiles upsert (name, age, gender, height, weight, activity_level)
   goals: update latest row by id, else insert
-> setEditedAt(Date.now()), toast "Profile updated"
-> invalidate ["profile-bundle"], ["active-plan"]
```

No AI is called. The plan stays exactly as it was. The only feedback is the existing stale banner:
`isPlanStale(bundle, editedAt)` — true when the local `editedAt` timestamp or the latest `goals.created_at`
is newer than `activePlan.created_at`. It is purely informational, with no action button, and `editedAt`
is component state so it disappears on reload (the `goals.created_at` check only fires when a goals row
was inserted rather than updated).

Plan generation exists only in onboarding: `useServerFn(generateAiPlan)` then `invalidatePlanCaches(qc)`
(invalidates `active-plan`, `today-meals`, `today-workout`, `progress-logs`, `profile-bundle`).
`generateAiPlan` re-reads profile/goals/schedule server-side, selects candidates, calls Gemini with up to
2 attempts, validates schema + schedule + candidate slugs, then persists atomically via `save_ai_plan`
(which deactivates prior plans and inserts the new one).

Schedule updates (`/schedule-update`) insert a new `schedules` row, call `analyzeTimetable`, invalidate
only `profile-bundle`, and never regenerate the plan.

## 2. Field classification (verified against `PlanInputs` / `buildPlanPrompt` / `selectCandidates`)

Plan-affecting (all are read by the prompt or the selector):

- profiles: `age`, `gender`, `height`, `weight`, `activity_level`
- goals: `goal_type`, `workout_preference`, `meal_preference`, `workout_duration`, `preferred_time`,
  `biggest_challenge` (it is printed in the prompt, so it counts)

Non-plan-affecting:

- profiles: `full_name` (only interpolated as a greeting name), `email`
- goals: `target_weight` — editable in Profile but **never read** by `generateAiPlan`. Today a change to it
  would not alter the plan at all. Recommendation: add `target_weight` to `PlanInputs` and the prompt (it is
  genuinely plan-relevant for calories), then classify it as plan-affecting. Otherwise it must be excluded
  from the trigger set to avoid pointless Gemini calls.
- goals: `workout_days` (carried over untouched; also unused by the prompt).

## 3. Detecting a meaningful change

Safest comparison is **server-side, before/after the write**, not against React form strings:

1. In one authenticated server function, read the current profile + latest goals row.
2. Normalize both sides (trim strings, `"" -> null`, numbers via `Number()`, so `70` vs `70.0` vs `"70"`
   compare equal).
3. Apply the writes.
4. Compare the normalized *previous* snapshot to the normalized *committed* values over the plan-affecting
   key list only.
5. Return `{ changed: boolean, changedFields: string[] }`.

This avoids false positives from formatting, and false negatives from a client that thinks nothing changed.

## 4. Proposed regeneration flow

Reuse the existing generator; add no second one.

```text
Save clicked
  -> saveProfileDetails (new server fn, authenticated)
       validate -> write profiles + goals -> diff -> { changed, changedFields }
  -> if !changed: toast "Profile updated", invalidate profile-bundle. Done.
  -> if changed: UI enters "Updating your plan…" state
       -> generateAiPlan()  (unchanged; it re-reads the freshly committed rows)
       -> on success: invalidatePlanCaches(qc), toast "Plan updated"
       -> on failure: keep saved details, show stale/retry card
```

Two sequential calls rather than one combined server function, so a Gemini failure can never be confused
with a save failure and the client can show two distinct states.

Alternative rejected: doing the save inside `generateAiPlan`. It would couple two operations with different
failure semantics.

## 5. Failure behaviour

- Never roll back profile/goals; they are already committed by the time Gemini runs.
- Old plan stays active (`save_ai_plan` only runs on a fully validated plan, so a failure leaves the DB untouched).
- Reuse and strengthen the existing stale infrastructure: persist the "needs regeneration" signal instead of
  relying on component state. Simplest reliable approach with no migration: mark it stale when
  the latest goals row timestamp is newer than `activePlan.created_at`. Since `saveProfileEdits`
  currently *updates* the goals row in place (no `updated_at` column on `goals`), the reliable options are
  (a) always insert a new goals row on save — append-only, matches how onboarding writes it, no migration; or
  (b) add `goals.updated_at` with a trigger — small migration. Recommend (a).
- Stale card gains: message “Your details were updated, but we couldn’t refresh your plan yet.” plus a
  **Retry plan generation** button calling the same `generateAiPlan`.
- All states terminate: pending -> success or error card. No indefinite spinner.

## 6. Loading UX

- Save button shows `Updating your plan…` with the spinner during regeneration; the edit section stays closed.
- Duplicate protection: `save.isPending || regenerate.isPending` disables Save; a `useRef` in-flight guard
  prevents a second `generateAiPlan` for the same edit; React Query mutation state covers rapid clicks.
- Navigation: regeneration runs from a component mutation, so leaving Profile drops the client-side
  completion handling while the server request still completes and saves the plan. Recommended behaviour for
  this app: keep the user on Profile with a non-blocking progress card (typical generation is ~10–25 s), and
  also invalidate plan caches when Profile next mounts so a navigated-away user still sees fresh data.

## 7. workout_duration today

The prompt gives one line: `Workout length must match the duration preference (use 30-45 min when "flexible")`.
There is no rule tying duration to exercise count, sets or rest, and `validatePlanAgainstSchedule` only checks
slot fit — `duration_minutes` is never compared to the preference. Observed in the earlier live test: a 15-minute
preference still produced 3 exercises/day with normal sets.

Needed (minimal, prompt + validation only):

- Prompt guidance table, e.g. 15 min -> 3–4 exercises, 2 sets, 30–45 s rest, circuit style; 30 min -> 4–5
  exercises, 3 sets; 45 min -> 5–7 exercises, 3–4 sets, 60–90 s rest; 60 min -> 6–8 exercises with accessory work.
- A business rule alongside the existing validators: `duration_minutes` must be within tolerance of the
  preference, `scheduled_end - scheduled_start` must equal `duration_minutes`, and exercise count must be inside
  the band for that duration. Failures feed the existing retry feedback.

## 8. Nutrition

`daily_calories`, `daily_protein` and per-meal macros are produced entirely by Gemini from the single rule
“Calories and protein must be realistic … (Mifflin-St Jeor + activity factor)”. Nothing is computed in code.
The prompt already receives age, gender, height, weight, activity level, goal, meal preference and the whole
weekly workout context, so a regeneration with a new weight/goal/activity will recalculate coherently — no fixed
"+X calories per minute" rule anywhere, which is what we want.

Minimal improvement: state explicitly that `summary.daily_calories` must be consistent with each `meal_days`
total and reflect the weekly training volume, and (if adopted) include `target_weight` in the nutrition rule.
No schema change.

## 9. Schedule interaction

- `preferred_time` is a goals field, so it is already inside the Profile trigger set.
- Uploading a new timetable changes the hard constraints for every workout and meal time; the current plan can
  end up overlapping classes. It should therefore use the *same* regeneration path: after `analyzeTimetable`
  succeeds, call `generateAiPlan`, then `invalidatePlanCaches`, with the same failure UX (schedule saved, plan
  stale + retry).
- Schedule staleness needs the same signal: compare latest `schedules.created_at` against `activePlan.created_at`
  in `isPlanStale`, which currently ignores schedules entirely.

## 10. Completions and history

`save_ai_plan` deactivates old plans and inserts new rows; it never deletes. `workout_completions.workout_day_id`
and `meal_completions.meal_item_id` reference the *old* plan's rows, which continue to exist, so all history
survives. `progress-data` reads completions joined to their own `workout_days`/`meal_items`, so historical stats
stay correct across plan changes. `progress_logs` are user-scoped and untouched.

One consequence to accept, not fix: today's completions were recorded against the old plan's day/meal rows, so
after a mid-day regeneration today's checkboxes appear unticked (the new rows have no completions). Historical
totals are unaffected. No change required; optionally mention it in the success toast.

## 11. Cost / concurrency protection

Keep it simple:

- One React Query mutation for the save+regenerate sequence; `isPending` disables Save and Retry.
- A `useRef` in-flight flag so a remount cannot start a second generation.
- Skip regeneration entirely when the server diff reports no plan-affecting change (the main cost saver).
- Optional cheap server guard inside `generateAiPlan`: refuse if the user's active plan was created less than
  ~20 seconds ago, returning the existing plan instead. No queue, no job table.

## 12. Files that would change

- `src/lib/profile-data.ts` — normalization + plan-affecting key list; make goals writes append-only; extend `isPlanStale` with schedules.
- `src/lib/profile.functions.ts` (new) — authenticated `saveProfileDetails` returning `{ changed, changedFields }`.
- `src/components/dashboard/ProfilePanel.tsx` — sequenced save → regenerate, "Updating your plan…" state, stale/retry card.
- `src/routes/_authenticated/schedule-update.tsx` — regenerate after successful analysis, same failure UX.
- `src/lib/plan-prompt.ts` — duration-to-structure guidance, nutrition consistency rule, optional `target_weight`.
- `src/lib/plan-schema.ts` — duration/volume business validation feeding the existing retry.
- `src/lib/plan.functions.ts` — pass `target_weight` through `PlanInputs`; optional recent-plan guard.
- `src/lib/plan-diagnostics.ts` — add a `regeneration` trigger event (non-sensitive).

**Database migration: not required** with the append-only goals approach. Only needed if we prefer `goals.updated_at`.

## 13. Risks

- Regeneration takes 10–25 s and can fail on AI rate limits; the stale + retry path is the mitigation.
- A user who edits repeatedly can trigger several sequential generations; the no-op diff and in-flight guard limit this.
- Today's completion ticks reset visually after regeneration (history preserved).
- Tightening duration/volume validation raises the chance of a retry, and after 2 failed attempts generation errors
  out — tolerances must be generous.
- `target_weight` currently does nothing; adding it to the prompt slightly changes plan output for all users.
