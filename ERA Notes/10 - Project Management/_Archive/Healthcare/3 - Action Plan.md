---
created: 2026-07-17
updated: 2026-07-17
type: action-plan
status: active
owner: Elio
tags:
  - pm/action-plan
  - module/healthcare
---

# Healthcare · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Immediate (unblocks everything)

1. **Run `migrations/2026-07-17_healthcare-core.sql` in the Supabase SQL Editor.** Until then the module 500s on missing tables.
2. Verify on mobile viewport: create self + partner profiles, add a "peanut" allergy, open a recipe containing "peanut butter" → banner + inline flag from **both** accounts; confirm a private condition is invisible to the partner (HLTH-7).

## Phase 2 — Medications (safety-critical; recurrence-safety + timezone-handling skills mandatory)

- Migration: `health_medications`, `health_medication_logs` (UNIQUE(medication_id, occurrence_date, dose_time)), `items.source_medication_id` FK + partial index, `mirror_medication_occurrence_action()` trigger, RPCs `create_medication_with_items` / `update_medication_schedule` / `set_medication_status`.
- `POST /api/health…/medications`: transactional materialization (one reminder item per dose-time, priority `urgent`), **awaited** `syncItemToGoogleCalendar` + `google_event_id` re-read (verified sync), `gcal_status` bookkeeping, warn-but-allow when disconnected.
- Extend `src/app/api/cron/gcal-reconcile/route.ts`: med items first, heal `gcal_status` both ways.
- Dose logging: existing occurrence actions (offline via existing queue) mirrored by the DB trigger; adherence view.
- Verification battery: 2-dose med → exactly 2 items + 2 Google events; native alarm fires with app closed on a real phone; schedule edit → zero duplicates; offline complete → replay → one log row.

## Phase 3 — Catalogue junction

- Extend `HealthcareItemMetadata` (`insurance_provider`, `policy_number`, `insurance_expiry`, `expiry_reminder_days`) + `MODULE_DISPLAY_FIELDS` + edit dialog.
- Generic expiry→reminder-item materialization in the catalogue item mutation route (`source_catalogue_item_id` mechanism); also serves `DocumentItemMetadata.expiry_date` (currently dead data).
- `catalogue_item_id` pickers on health record forms; Care Contacts card on `/healthcare`.

## Phase 4 — Seams & domain skill

- Vaccine `next_due_on` boosters via the same materialization choke point.
- Hub Chat "took my pill" intent (AI proposes → human confirms) + briefing signals from `get_health_bundle`.
- Meal-planning allergen badges; optional med stock + refill reminders.
- Author `healthcare` domain skill via skill-factory; register in CLAUDE.md + start-task.
