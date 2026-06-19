---
slug: today
title: Plan My Day (merged → /reminders)
category: junction-page
route: /reminders
type: page
parent: null
children: []
status: active
tags:
  - junction-module
---

# Plan My Day

> Merged into the `/reminders` Focus tab (2026-06-17). The former `/today` route is now a redirect. `WebDayPlanner.tsx` is the single merged surface: default view shows a selected-day panel with a next-item focus and remaining list. The top action row provides Plan my day and Overdue controls; Today is a quick-jump inside the day navigation row. Overdue rows are hidden by default and open as their own section when enabled; Upcoming is collapsed by default; Assigned sections appear on today only. The `/reminders` Assign tab provides mobile flexible routine slot assignment.

## Files

- **Page** (Focus tab): `src/app/reminders/page.tsx`
- **Redirect**: `src/app/today/page.tsx` → `/reminders?date=…&plan=1`
- **Main component**: `src/components/planner/WebDayPlanner.tsx`
- **Assignment component**: `src/components/planner/MobileFlexibleAssignmentPage.tsx`

## Hooks

- `src/features/day-plan/useDayPlan.ts` — `useDayPlan`, `useUpsertDayPlan`, `useDeleteDayPlan`, `useChecklistActions` (live done/undone toggle; add/remove/reorder stays in draft until Save)
- `src/features/items/useFlexibleRoutines.ts` — `useFlexibleRoutines`, `useScheduleRoutine`, `useUnscheduleRoutine`
- `src/features/items/useItemActions.ts` — `useItemActionsWithToast`, `useAllOccurrenceActions`, `useDeleteItemWithUndo`
- `src/features/items/useItems.ts` — `useItems`, `useCreateReminder`, `useUpdateItem`, `useUpdateRecurrenceRule`
- `src/lib/utils/dayOccurrences.ts` — `getOccurrencesForDay`, `expandOccurrencesInRange` (shared "what lands on day X" util)

## API routes

- `GET /api/day-plans?date=YYYY-MM-DD` → `src/app/api/day-plans/route.ts`
- `POST /api/day-plans` (full upsert incl. `checklist`, fired only on Save) → `src/app/api/day-plans/route.ts`
- `PATCH /api/day-plans/[id]` (live checklist item done/undone toggle) → `src/app/api/day-plans/[id]/route.ts`
- `DELETE /api/day-plans/[id]` → `src/app/api/day-plans/[id]/route.ts`

## DB tables

- `day_plans` (see `migrations/2026-06-16_plan-my-day.sql` + `migrations/2026-06-17_day-plan-checklist.sql`)
- `items`, `item_flexible_schedules`, `item_recurrence_rules`, `item_occurrence_actions` (read via existing Items/Schedule hooks)

## How to get here

- Default: navigate to `/reminders` (Focus tab is the planner)
- "Plan this day" link in `WebTodayView.tsx` header → `/reminders?date=…&plan=1`
- `onPlanDay` in `WebCalendar.tsx` (calls `DayExpansionModal`) → `/reminders?date=…&plan=1`
- `onPlanDay` in `CalendarView.tsx` (calls `MobileDayExpansionModal`) → `/reminders?date=…&plan=1`
- Direct URL: `/reminders?date=YYYY-MM-DD&plan=1` (opens to planning mode on that date)
- Legacy: `/today?date=YYYY-MM-DD` → redirects above

## What it links to

- All interactions are in-page — no child routes.

## Related vault doc

- `ERA Notes/03 - Junction Modules/Plan My Day/Overview.md`

## Notes

- Junction module: imports across Items/Schedule standalone (`useItems`, `useFlexibleRoutines`, `useItemActions`).
- Reuses shared `dayOccurrences.ts` — never reimplement "what lands on day X" locally.
- Three UI states: **browsing** (no plan) → **planning** (editing) → **preview** (plan saved).
- Checklist is `{id, label, done_at, sort_order}` — no time field; drag-to-reorder via dnd-kit.
- Save-gated draft model: one POST on "Save day plan"; checklist check-off is a separate live PATCH.
- URL flag `?plan=1` auto-opens planning mode; handled by a second effect after data loads to prevent race with the main seeding effect.
- Upcoming (+1d to +7d) stays collapsed until opened.
- The `/reminders` Assign tab is the mobile-friendly flexible slot picker; Schedule Insights moved to `/dashboard`.
