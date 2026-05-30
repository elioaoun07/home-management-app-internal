---
created: 2026-05-30
type: overview
module: chores
module-type: standalone
status: active
tags:
  - type/overview
  - module/chores
related:
  - "[[Common Patterns]]"
---

# Chores

> **Page:** `src/app/chores/` | **Feature:** `src/features/chores/` | **Components:** `src/components/chores/`
> **DB Tables:** `items` (`is_chore = true`), `item_occurrence_actions`, `reminder_details`
> **Type:** Standalone
> **Route:** `/chores`

## Overview

Household chore management — a simplified view over Items where `is_chore = true`. Shows an "Up Next" hero card, grouped chore lists, quick completion, and a Sunday check-in for unresolved chores. Deliberately simpler UX than the full Items/Schedule: completion is the primary action, not editing.

## Architecture

Chores are not a separate table — they are `items` rows with `is_chore = true`. The feature hooks (`useChores`, `useChoreActions`) filter on this flag. Completing a chore writes to `item_occurrence_actions` with `action_type = "completed"` and the actual completion timestamp. The planned slot is preserved in `metadata_json.planned_for` so the Sunday check-in and analytics can correlate planned vs. actual.

**Sunday check-in**: collapsed panel, shows unresolved chores from the previous week. Two resolutions:
- Done but not marked → user supplies actual completion date/time.
- Not done → `action_type = "skipped"` with a required reason.

Chore instances are planned via the Web Calendar Flexible Items view (not in the mobile chores page).

## Database

| Table | Role |
|---|---|
| `items` | Source rows — `is_chore = true`, `chore_category` enum (cleaning/laundry/cooking/garden/maintenance/general) |
| `item_occurrence_actions` | Completion and skip records; `metadata_json.planned_for` holds the original scheduled slot |
| `reminder_details` | Recurrence config for recurring chores |

## Key Files

- `src/app/chores/page.tsx` — page entry
- `src/components/chores/StandaloneChoresPage.tsx` — mobile root layout
- `src/components/chores/UpNextHero.tsx` — hero card for next due chore
- `src/components/chores/ChoreCard.tsx` — individual chore row
- `src/components/chores/ChoreGroupList.tsx` — grouped list by category/day
- `src/components/chores/ChoreCheckInPanel.tsx` — Sunday check-in UI
- `src/components/chores/ChoreActionsSheet.tsx` — postpone/skip/assign sheet
- `src/components/chores/ChorePostponeSheet.tsx` — postpone date picker
- `src/components/chores/ChoresFilterBar.tsx` — filter controls
- `src/components/web/WebChores.tsx` — desktop layout
- `src/features/chores/useChores.ts` — query hook (filters `items` by `is_chore`)
- `src/features/chores/useChoreActions.ts` — complete/skip/postpone mutations
- `src/app/api/items/[id]/complete/route.ts` — completion API
- `src/app/api/items/[id]/actions/route.ts` — skip/postpone API

## Gotchas

- Chores share the `items` table — any query touching `items` without `is_chore` filtering will include chores. Always scope queries appropriately.
- Trips integration: when a trip is activated, recurring chores are auto-skipped via `trip_side_effects` (`effect_type = 'chore_skip'`). Reverting a trip un-skips them.
- Do not add a time-spent prompt — chores intentionally skip that field.

## See Also

- [[Items & Reminders]] — shared DB table and API
- [[Trips]] — chore skip side-effects on trip activation
- [[Common Patterns]]
