---
created: 2026-10-12
type: feature-doc
module: Fitness
module-type: standalone
status: active
tags:
  - type/feature-doc
  - module/fitness
related:
  - "[[Common Patterns]]"
  - "[[Sync and Offline]]"
---

# Fitness

> **Module:** `src/features/fitness/` + `src/components/fitness/` + `src/lib/fitness/` | **API:** `src/app/api/fitness/` | **Page:** `src/app/fitness/`
> **DB Tables:** `fitness_plans`, `fitness_plan_versions`, `fitness_plan_slots`, `fitness_plan_pauses`, `fitness_sessions`, `fitness_set_logs`, `fitness_reward_events`, `fitness_preferences`, `fitness_operations` (+ Healthcare `health_measurements`)
> **Type:** Standalone
> **Status:** Code complete 2026-10-12 (HLTH-28). Migration `migrations/2026-10-12_fitness-module.sql` is **owner-run and unapplied**; it requires SCH-24 (`2026-10-11_atomic-item-create.sql`) first and aborts otherwise.

## Overview

Follow an imported personal-trainer plan, log workouts fast, and see progress. Four tabs — **Today · Plan · Quests · Progress** — plus a focused workout screen. Gym + recovery (strength, basic cardio, mobility, recovery). Private by default.

## Architecture

- **Import contract.** `src/lib/fitness/ptPlan.ts` is the one source for runtime validation, the committed JSON Schema (`pt-plan.v1.schema.json`, derived by `z.toJSONSchema`, test-locked), examples, and the "Copy AI prompt" text (schema + faithful-conversion rules). Structural errors (bad JSON, unknown `schema_version`, extra properties, duplicate ids, broken refs, reversed reps, malformed groups, out-of-range numbers) block import with field paths. Semantic issues save a **draft**: `fix` issues (no exercises, omitted set count) need a new version; `review` issues (AI-reported, week/phase-specific wording, uneven superset rounds) can be acknowledged. The AI's `issues` array is kept but never the only check. Duplicate detection = SHA-256 of normalized content (minus AI issues/source notes), unique per owner → 409 → **Open existing**.
- **Plans** are versioned (`fitness_plan_versions.content` = validated PTPlanV1). A new version applies to future sessions; sessions keep their `snapshot`. A live plan's new version must keep the slot count and be activation-ready (slot identities stay stable); Schedule item titles are updated.
- **Schedule integration.** Activation (one active/paused plan per user) calls `create_item_complete` once per `workout_order` entry: a private reminder with a weekly flexible rule, bounded by `duration_weeks`. Repeated references are distinct slots ("Upper", "Upper · 2"). Placement writes `item_flexible_schedules` (same upsert key as the planner → moving keeps identity). Pause/archive set `items.archived_at` (the flexible engine ignores `recurrence_pauses`) and record `fitness_plan_pauses` (streak neutrality).
- **One authoritative completion.** `fitness_finish_session` writes the session, the Schedule `completed` occurrence (metadata `fitness_session_id`) and rewards in one transaction. A completion made in Schedule fires `fitness_mirror_occurrence_action` (SECURITY DEFINER): it completes that week's open session for the slot or records a minimal **schedule-source session with no sets**; later logging enriches the same session. Un-completing reverts it. Skip/cancel never create sessions or rewards. `app.fitness_mirror_off` stops echoes.
- **Rewards are server-derived.** `fitness_recompute_rewards_for()` rebuilds the full reward set from completed sessions + set logs after every mutation; identity = `source_key` (`train:<day>`, `recover:<day>`, `quest-*:<week>`, `badge:*`, `pr:<session>:<exercise-key>:<metric>`, `rank:*`). Undo/correction **revokes** (keeps `celebrated_at`), so retries never double-award and re-grants never replay a reveal. Constants live only in `public.fitness_rules()`; `FIXTURE_RULES` mirrors it and the DB test asserts equality.
- **Records** compare only same exercise (or substitution) + equipment + load kind; external load needs reps ≥ 1; bodyweight compares reps; duration/distance separately. Volume is shown only for external loads with known reps and load. Unknown stays unknown.
- **Writes** are SECURITY DEFINER RPCs with explicit `auth.uid()` ownership checks and durable receipts (`fitness_operations`, advisory-locked per op id). Route error map: `src/lib/fitness/server.ts` (FT409 → reviewable conflict with the server row; FT422 → 422; missing function/table → **503 + migration path**, never a partial fallback).
- **Hot read** `get_fitness_bundle()` (one RPC): rules, preferences, plans, live plan + slots (placements, last 21 days of actions), open session + sets, previous sets per workout, 60 recent sessions, 27 weeks, reward totals/events/badges, records, self Healthcare profile link, partner summary. History pages: `GET /api/fitness/sessions?before=`.
- **Offline.** The `fitness` query root is persisted. Confirmed-offline workout writes (start, log/clear set, finish, reopen, delete/restore) go to the IndexedDB queue; `mergeOffline()` overlays them so a workout runs entirely offline and stays visibly **Pending**. Repeated edits of one set are coalesced. Replays are idempotent (receipts). A 4xx replay (e.g. FT409 conflict) is **held** (`reviewRequired`) with its input — Fitness shows Keep mine / Discard. Fitness ops are never aged out. Import, activation/schedule changes and measurement writes require connectivity. A timeout is reconciled against the receipt and otherwise reported as "Save unverified" with Retry (same op id) — never queued.
- **Rest timer** deadline is stored in `localStorage` (`fitness:rest:<session>`) so refresh/backgrounding recover it; audio is opt-in (Settings → Rest sound) and only plays in the foreground; no background alarms.
- **Visuals.** `ProgressCore` (SVG): XP ring, weekly slot segments that light as sessions finish, ambient glow/orbit, particles into the meter on XP gain; cosmetics by rank (Momentum comet trail, Vanguard tick crown, Apex triple ring + orbiters) selectable in Quests. Effects toggle, `prefers-reduced-motion`, and hidden-tab all stop ambient motion. Celebrations only for badges/records/rank-ups, one at a time.

## Database

All `fitness_*` tables carry `user_id` with **SELECT-own RLS only**; all writes go through the RPCs (clients cannot award themselves XP). `fitness_preferences` is owner FOR ALL. Key constraints: one open session per user (partial unique), one completion per slot per week, one live plan per user, `(user_id, content_fingerprint)` unique, `(user_id, source_key)` unique rewards, `(session_id, exercise_id, set_index)` unique set logs with a `revision` for conflict detection. `health_measurements`: owner-only RLS (`managing_user_id`, stamped by the existing `health_child_sync_managing_user()` trigger); canonical kg/cm + `measured_at`.

## Key Files

See the [Feature Map](<../../01 - Architecture/Feature Map/standalone/fitness.md>).

## Gotchas

- **Migration order:** SCH-24 first. The Fitness migration's prerequisite block raises a readable error if `create_item_complete(jsonb)` is missing. Local dev hits the production DB — until the owner runs both, `/fitness` shows "Fitness setup pending" (503). Use `?fixture=` for visual work.
- **Measurements are private even on shared profiles** (deliberate; not in `get_health_bundle`). Outfits' `wardrobe_profiles.height_cm/weight_kg` stay separate — no sync, no migration.
- **BMI** uses the latest height at or before each weight; missing height → "Needs height". Informational only, behind an `i` popover.
- **The Schedule complete route uses the service role and allows a household partner** to complete a partner's item; for a Fitness slot that creates a minimal session for the owner. Fitness items are private (`is_public = false`) so this needs the item id.
- **Deleting a slot item in Schedule** does not revert history (the mirror ignores FK-cascade deletes); the slot then has no item until the plan is re-activated.
- **No double-click actions** (Hard Rule 2): week tiles open placement; Start is explicit.
- **Undo** exists for import (deletes a never-used plan), new version (only while unused), activation (only while untouched — otherwise Pause/Archive), plan state, placement, finish (reopen), discard/delete session, measurements and preferences. Set logging has no toast (calm logging): a logged set is edited/cleared inline.

## See Also

- [[Common Patterns]] · [[Sync and Offline]] · Healthcare Overview (measurements) · Items & Reminders Overview (flexible routines)
- PM: Healthcare campaign — HLTH-28 (module), HLTH-29 (owner migration + phone acceptance)
