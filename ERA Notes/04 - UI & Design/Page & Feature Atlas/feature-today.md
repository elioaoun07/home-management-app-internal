---
slug: today
title: Plan My Day
category: junction-page
route: /today
type: page
parent: null
children: []
status: active
tags:
  - junction-module
---

# Plan My Day

> Disrupted-day planner — triage everything landing on a given day (one-time, recurring, flexible), push off or prepone items, add ad-hoc tasks and checkpoints, and save day notes/intent. An unplanned day shows an editable draft form (Save commits it); a planned day shows a read-only preview card (Edit re-opens the draft, Delete removes it) — no API calls fire while editing, only on Save/Delete.

## Files

- **Page**: `src/app/today/page.tsx`
- **Main component**: `src/components/planner/WebDayPlanner.tsx`

## Hooks

- `src/features/day-plan/useDayPlan.ts` — `useDayPlan`, `useUpsertDayPlan`, `useDeleteDayPlan`, `useCheckpointActions` (live done/undone toggle only — add/remove is drafted client-side until Save)
- `src/features/items/useFlexibleRoutines.ts` — `useFlexibleRoutines`, `useScheduleRoutine`, `useUnscheduleRoutine`
- `src/features/items/useItemActions.ts` — `useItemActionsWithToast`, `useAllOccurrenceActions`, `useDeleteItemWithUndo`
- `src/features/items/useItems.ts` — `useItems`, `useCreateReminder`
- `src/lib/utils/dayOccurrences.ts` — `getOccurrencesForDay` (shared "what lands on day X" util, also used by `WebTodayView`)

## API routes

- `GET /api/day-plans?date=YYYY-MM-DD` → `src/app/api/day-plans/route.ts`
- `POST /api/day-plans` (full upsert incl. `checkpoints`, fired only on Save) → `src/app/api/day-plans/route.ts`
- `PATCH /api/day-plans/[id]` (live checkpoint done/undone toggle only) → `src/app/api/day-plans/[id]/route.ts`
- `DELETE /api/day-plans/[id]` → `src/app/api/day-plans/[id]/route.ts`

## DB tables

- `day_plans` (own table — see `migrations/2026-06-16_plan-my-day.sql`)
- `items`, `item_flexible_schedules`, `item_recurrence_rules`, `item_occurrence_actions` (read via existing Items/Schedule hooks)

## How to get here

- "Plan this day" link in `WebTodayView.tsx` header
- "Plan this day" button in `DayExpansionModal.tsx` (web calendar day click)
- "Plan this day" button in `MobileDayExpansionModal.tsx` (mobile calendar day click)
- Direct URL: `/today?date=YYYY-MM-DD` (defaults to today)

## What it links to

- All interactions are in-page (push-off, prepone, checkpoints, ad-hoc tasks) — no child routes.

## Related vault doc

- `ERA Notes/03 - Junction Modules/Plan My Day/Overview.md`

## Screenshots

- n/a

## Notes

- Junction module: imports across the Items/Schedule standalone (`useItems`, `useFlexibleRoutines`, `useItemActions`).
- Reuses the shared flexible-item placement rule from `dayOccurrences.ts` — never reimplement "what lands on day X" locally.
- Phase 1 only (triage list); hourly timeline + mood/energy optimizer are deferred (see vault doc).
- Save-gated draft model added 2026-06-16 — see vault doc "The save-gated draft model" section.
