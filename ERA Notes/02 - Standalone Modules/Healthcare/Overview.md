---
created: 2026-07-17
type: feature-doc
module: Healthcare
module-type: standalone
status: active
tags:
  - type/feature-doc
  - module/healthcare
related:
  - "[[Common Patterns]]"
---

# Healthcare

> **Module:** `src/features/healthcare/` | **API:** `src/app/api/healthcare/` | **Page:** `src/app/healthcare/`
> **DB Tables:** `health_profiles`, `health_allergies`, `health_conditions`, `health_vaccines`, `health_medications`, `health_medication_logs` (+ `items.source_medication_id`)
> **Type:** Standalone
> **Status:** Active — Phase 1 shipped 2026-07-17 (of 4; plan of record in [[../../10 - Project Management/Healthcare/2 - Vision & Roadmap|PM · Vision & Roadmap]])

## Overview

Family health profiles: allergies (junction → Recipes warnings), medical history (conditions/surgeries/visits), vaccines, and medications with a daily dose checklist materialized as urgent Schedule reminder items (shipped as code 2026-09-26, HLTH-24; verified Google Calendar status is HLTH-9).

## Architecture

- **One bundle read** (Hard Rule 21): `GET /api/healthcare` → `get_health_bundle()` SECURITY DEFINER RPC returns profiles + allergies + conditions + vaccines in one call. Own profiles always; partner profiles only when `shared_with_household = true`.
- **Allergen feed** (separate, always household-wide): `GET /api/healthcare/allergens` → `get_household_allergens()` returns minimal `{allergen, severity, keywords, profile_name}` rows for EVERY profile in the household, regardless of sharing — whoever cooks must see them. Consumed by `useHouseholdAllergens()` (`src/hooks/useHouseholdAllergens.ts`, shared layer so Recipes never imports the healthcare feature dir), persisted via the `household-allergens` STABLE_KEYS entry in `src/app/providers.tsx` so recipe warnings work offline.
- **Matching**: `src/lib/health/allergenMatch.ts` — pure keyword matcher (word-boundary + simple plurals) over free-text `recipes.ingredients[].name`, seeded from `ALLERGEN_SYNONYMS` (Lebanese staples included) at allergy creation; **stored per-allergy `keywords[]` always win** so user edits fix false matches. Warning aid, never a guarantee or a gate.
- **Recipe surfaces**: `RecipeAllergenBanner` + `IngredientAllergenFlag` (`src/components/web/RecipeAllergenWarning.tsx`) rendered in `RecipeDetailView`.
- Mutations: standard CRUD routes (auth → Zod → insert with `managing_user_id` from session → 23505→409), hooks with safeFetch + real inverse-action Undo toasts (`src/features/healthcare/hooks.ts`).

### Medications (HLTH-24)

- **Model.** `mode` = `course` (fixed wall-clock `dose_times` from the `starts_at` first dose until the exclusive `ends_at`; null = ongoing) or `as_needed` (symptom-driven; optional `min_hours_between` / `max_per_day`; no reminders). `food_timing` = `any | empty_stomach | with_food`. Times are in the medication's own IANA `timezone`.
- **Dose identity.** A course dose is its slot instant: `health_medication_logs` unique `(medication_id, scheduled_at)`. As-needed doses have `scheduled_at` NULL and a client-generated id. Double-tap, retry and mirror writes all collapse to one row.
- **Reminders.** `health_rebuild_medication_reminders()` creates one `urgent` recurring `reminder` item per dose time (`FREQ=DAILY`, anchored on the first slot ≥ `starts_at`, `end_until` = last slot < `ends_at`), with an absolute `item_alerts` row on the next future slot; the existing `item-reminders` cron fires and re-arms it. Items carry `source_medication_id` and `metadata_json.medication_dose_time`. Every save **replaces** them (delete + recreate, one transaction) and re-marks taken doses as completed occurrences.
- **Two-way sync.** Health → Schedule: `health_set_dose()` writes the log and the item's completed occurrence together. Schedule → Health: triggers `health_mirror_occurrence_done/undone` on `item_occurrence_actions` log/un-log the nearest dose slot. `app.health_mirror_off` (transaction-local) stops the RPCs' own writes and reminder rebuild cascades from echoing.
- **Writes are RPCs** (`health_save_medication`, `health_set_medication_deleted`, `health_set_dose`) — SECURITY INVOKER, so items/health RLS applies; only the mirror trigger is SECURITY DEFINER. Routes: `src/app/api/healthcare/medications/` + shared server helpers `src/lib/health/medicationServer.ts`. Google Calendar is best-effort around the RPCs (events removed before a rebuild, created after).
- **Checklist math** is `src/lib/health/medicationSchedule.ts` (pure, tested) — slot generation for one day, course totals/day counter, next dose, as-needed wait. It mirrors the SQL rules; it is not an item-recurrence expansion engine.
- **UI** `src/app/healthcare/MedicationsSection.tsx`: Doses card (‹ day › switcher, tap to tick, as-needed "Take" with Undo) and Medications card (tap row to edit).

## Database

- All four tables carry **`managing_user_id`** (denormalized on children by the `health_child_sync_managing_user()` BEFORE-trigger from the parent profile) with **owner-only RLS** (`managing_user_id = auth.uid()` FOR ALL). Household visibility happens ONLY inside the two SECURITY DEFINER RPCs — Hard Rule 20 compliant, no EXISTS-subquery policies.
- `health_profiles.user_id` **nullable** — `NULL` = dependent without an account (child/parent). `is_self` on create maps to the session user id; a profile can never claim another account.
- Profile delete is **soft** (`deleted_at`) so Undo restores children intact; child records hard-delete with re-create Undo.
- Severity/kind/status are text + CHECK constraints (not enums): `mild|moderate|severe|anaphylaxis`, `condition|surgery|doctor_visit`, `active|resolved`.
- Migration: `migrations/2026-07-17_healthcare-core.sql` (idempotent, must be run manually in Supabase SQL Editor; file removed from the repo in commit `2b7efdae` — recover with `git show 9a037d8f:migrations/2026-07-17_healthcare-core.sql`).
- `health_medications` / `health_medication_logs` follow the same owner-only pattern (`health_medications` reuses `health_child_sync_managing_user()`; logs use `health_log_sync_managing_user()` from the medication). Medications soft-delete (`deleted_at`) so Undo restores reminders and history. Migration: `migrations/2026-09-26_healthcare-medications.sql` (also replaces `get_health_bundle()` to add `medications` + `medication_logs`, last 120 days of logs).

## Key Files

- `src/features/healthcare/{types,queryKeys,hooks}.ts` — domain types, `healthcareKeys`, bundle query + CRUD mutations
- `src/hooks/useHouseholdAllergens.ts` — shared allergen feed hook + key (persisted)
- `src/lib/health/allergenMatch.ts` (+ `.test.ts`) — matcher, synonym seed, `deriveDefaultKeywords`
- `src/components/web/RecipeAllergenWarning.tsx` — banner / inline flag / list-dot components
- `src/app/api/healthcare/` — `route.ts` (bundle), `allergens/`, `profiles/`, `allergies/`, `conditions/`, `vaccines/` (+ `[id]/` each)
- `src/app/healthcare/HealthcareClient.tsx` — page UI; `MedicationsSection.tsx` — doses + medications; `healthUi.tsx` — shared modal/styles
- `src/app/api/healthcare/medications/` — create / edit / delete+restore / dose routes; `src/lib/health/medicationServer.ts` — server-only Zod + RPC error map + Google sync helpers
- `src/lib/health/medicationSchedule.ts` (+ `.test.ts`) — dose-slot math

## Gotchas

- **The module slug is `healthcare`, not `health`** — `/api/health` is the connectivity probe endpoint (`isReallyOnline()`, Hard Rule 7). Never reuse the `health` route namespace.
- **Allergies are intentionally NOT private** even when the profile isn't shared — this asymmetry is a product decision (recipe safety > privacy for this one record type). Don't "fix" it.
- The allergies POST relies on the DB trigger to stamp `managing_user_id` from the parent profile; RLS `WITH CHECK` then rejects writes against profiles you don't manage (surfaces as a 500 today — acceptable, unreachable via UI).
- Keyword matching runs on the **stored** keywords, never live from `ALLERGEN_SYNONYMS` — editing the synonym map does not change existing allergies.
- Recipe **list** cards have no allergen dot: `RecipeListItem` has no ingredients (lean payload). Deferred to HLTH-18.
- **Medication reminder items are owned by the medication.** Editing them in Schedule is overwritten on the next medication save; deleting one there stops that dose time's reminders (history is kept). Change schedules from Health.
- **Profile soft delete stops its medications' reminders** (`rebuildProfileMedicationReminders` in the profile DELETE route); Undo recreates them.
- **DST:** dose times are wall-clock and the SQL/checklist honour DST, but the `item-reminders` cron re-arms alerts with a UTC-fixed RRULE (existing engine behaviour) — a course crossing a DST change can push one hour off until the next save.
- Dose ticks are not queued offline (the health hooks use `safeFetch` without the IndexedDB queue) — offline ticks fail with a toast.
- Health `requestJson` calls for medication writes pass `timeoutMs: 30_000` (Google sync runs inside the request).

## See Also

- [[Common Patterns]] · [[Sync and Offline]]
- PM campaign: `ERA Notes/10 - Project Management/Healthcare/`
- Origin spec: Module Map Tier 1 #1 (`07 - Backlog & Ideas/ERA - Module Map & New Module Ideas.md`)
