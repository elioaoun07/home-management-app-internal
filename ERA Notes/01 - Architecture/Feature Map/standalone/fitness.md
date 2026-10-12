# Fitness

**Type:** Standalone
**Route:** `/fitness` (`?tab=plan|quests|progress`, `?w=1` = focused workout open; `?fixture=empty|active|week|rankup` = synthetic states, dev only)

## What it does

Imported PT plans (PTPlanV1 JSON), flexible weekly Schedule slots, workout logging with rest timer, deterministic server-side rewards (XP, quests, badges, records, ranks), and Healthcare weight/height/BMI.

## Files at a glance

- **Page entry**: `src/app/fitness/page.tsx` → `FitnessClient.tsx` (Suspense) → `src/components/fitness/FitnessPage.tsx`
- **Tabs**: `TodayTab.tsx`, `PlanTab.tsx` (slots, workouts, activate/review/version/pause/archive), `QuestsTab.tsx`, `ProgressTab.tsx` (consistency, records, history, body)
- **Focused workout**: `src/components/fitness/WorkoutScreen.tsx` (set controls, rest timer, supersets, Finish)
- **Core visual**: `ProgressCore.tsx` (SVG rings + framer-motion; cosmetics per rank), `Celebration.tsx`, `FitnessIcons.tsx`, `fitnessTheme.ts` (palette per theme, partner color), `fitnessUi.tsx`
- **Sheets**: `ImportSheet.tsx` (paste/.json, Copy AI prompt, schema download, validation, preview), `PlaceSheet.tsx` (day/time)
- **Hooks**: `src/features/fitness/hooks.ts` (bundle + offline overlay, every write via `writeFitness`)
- **Query keys**: `src/features/fitness/queryKeys.ts` (root `"fitness"`, persisted via STABLE_KEYS)
- **Contract (single source)**: `src/lib/fitness/ptPlan.ts` (Zod PTPlanV1, validator, fingerprint, JSON Schema, AI prompt) · committed schema `src/lib/fitness/pt-plan.v1.schema.json` · examples `src/lib/fitness/examples/*.json`
- **Shared logic**: `src/lib/fitness/{types,contracts,progress,offline,format,fixtures,server}.ts`
- **API routes**: `src/app/api/fitness/route.ts` (GET bundle) · `plans/` (POST import) · `plans/[id]/` (POST action) · `sessions/` (GET history, POST op) · `sessions/[id]/` · `slots/[id]/placement/` (PUT) · `preferences/` (PATCH) · `rewards/seen/` · `operations/[id]/` (receipt)
- **Healthcare measurements (shared)**: `src/app/api/healthcare/measurements/` · `src/lib/health/measurements.ts` (BMI) · `src/hooks/useHealthMeasurements.ts` · `src/components/health/MeasurementsCard.tsx`
- **DB tables**: `fitness_plans`, `fitness_plan_versions`, `fitness_plan_slots`, `fitness_plan_pauses`, `fitness_sessions`, `fitness_set_logs`, `fitness_reward_events`, `fitness_preferences`, `fitness_operations`, `health_measurements` — migration `migrations/2026-10-12_fitness-module.sql`
- **Tests**: `src/lib/fitness/*.test.ts` (incl. `fitness.database.test.ts`, PGlite against the real migration), `src/lib/health/measurements.test.ts`, `src/lib/OfflineSyncEngine.fitness.test.ts`

## Common edit scenarios

- **"Change XP / quest / badge / rank rules"** → `public.fitness_rules()` + `fitness_recompute_rewards_for()` in a new migration; mirror `FIXTURE_RULES` (`src/lib/fitness/fixtures.ts`, asserted equal in the DB test).
- **"Change the import format"** → `src/lib/fitness/ptPlan.ts` (then regenerate `pt-plan.v1.schema.json`; `ptPlan.test.ts` fails until they match). A new shape needs a new `schema_version`.
- **"Workout screen / set controls / rest timer"** → `WorkoutScreen.tsx`; prescription labels `src/lib/fitness/format.ts`.
- **"Progress core look / cosmetics"** → `ProgressCore.tsx` (+ `fitnessTheme.ts`).
- **"Weekly slot status, streak, next workout"** → `src/lib/fitness/progress.ts` (+ `progress.test.ts`).
- **"Offline logging / conflicts"** → `src/lib/fitness/offline.ts` (overlay), `hooks.ts` (`writeFitness`, `enqueueFitness`), `src/lib/offlineSyncEngine.ts` (fitness branch).
- **"Schedule completion ↔ workout"** → `fitness_finish_session` / `fitness_mirror_occurrence_action` in the migration.

## Connected modules

- **Items / Schedule** — each `workout_order` entry is a private weekly flexible routine item created through `create_item_complete` (SCH-24); placement = `item_flexible_schedules`; completion = `item_occurrence_actions` (+ mirror trigger). No new recurrence engine, no cron.
- **Healthcare** — shared `health_measurements` (owner-private); Fitness links to the user's own `health_profiles` row (`user_id = auth.uid()`), never creates one implicitly.
- **Household Sharing** — opt-in `fitness_preferences.share_summary`: partner sees rank, badges, weekly done/target only (`get_fitness_shared_summary`).
- **Sync & Offline** — `feature: "fitness"` in the IndexedDB queue; 4xx replays held for review, never aged out.
- **ERA** — reach row (navigation); `summarizeFitness()` is the read seam. No conversational commands in v1.
