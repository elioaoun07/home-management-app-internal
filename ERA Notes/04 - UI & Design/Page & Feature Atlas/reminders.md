---
slug: reminders
title: Reminders
category: main-tab
route: /reminders
type: page
parent: null
children: []
status: active
tags: []
---

# Reminders

> Mobile Schedule surface for day focus, planning, and flexible catalogue routine assignment.

## Files

- **Page**: `src/app/reminders/page.tsx`
- **Main components**:
  - `src/components/planner/WebDayPlanner.tsx` - Focus tab
  - `src/components/planner/MobileFlexibleAssignmentPage.tsx` - Assign tab

## Hooks

- `src/features/items/useItems`
- `src/features/items/useFlexibleRoutines`
- `src/features/items/useItemActions`
- `src/features/catalogue/useCatalogueItems`
- `src/features/catalogue/useCatalogueModules`
- `src/features/day-plan/useDayPlan`

## API routes

- `GET/POST /api/day-plans`
- `PATCH/DELETE /api/day-plans/[id]`
- `src/app/api/items/` routes via item action hooks

## DB tables

- `items`, `catalogue_items`, `item_flexible_schedules`, `item_recurrence_rules`, `item_occurrence_actions`, `day_plans`

## How to get here

- Tap **Reminders/Schedule** in mobile navigation
- `/today` redirects here with `?date=YYYY-MM-DD&plan=1`
- Direct URL: `/reminders`

## What it links to

- In-page item detail/actions modals
- `/expense` via the add-item FAB

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md`
- `ERA Notes/03 - Junction Modules/Plan My Day/Overview.md`

## Screenshots

- `reminders-mobile.png`
- `reminders-desktop.png`

## Notes

- Tabs are `Focus` and `Assign`. Schedule Insights moved to `/dashboard`.
- Upcoming (+1d to +7d) is collapsed by default in Focus.
- Assign lists flexible task catalogue templates not yet planned for the selected period, then adds one slot to the selected day/time.
