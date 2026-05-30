---
slug: focus
title: Focus
category: standalone-page
route: /focus
type: page
parent: null
children: []
status: active
tags: []
---

# Focus

> Daily focus surface — flexible (untimed) routines pool and AI-generated insights briefing.

## Files

- **Page**: `src/app/focus/page.tsx`
- **Layout**: `src/app/focus/layout.tsx`
- **Main component**: `src/components/focus/FocusPage.tsx`
- **Sub-components**:
  - `src/components/focus/FlexibleRoutinesPool.tsx`
  - `src/components/focus/ScheduleRoutineSheet.tsx`

## Hooks

- `src/features/items/useFlexibleRoutines` — flexible routine items
- `src/features/items/useFocusInsights` — AI-generated daily insight

## API routes

- `GET /api/focus-insights` → `src/app/api/focus-insights/`
- Items API for routine mutations → `src/app/api/items/`

## DB tables

- `items` (flexible flag)
- `focus_insights`

## How to get here

- ERA nav menu or direct URL: `/focus`

## What it links to

- `ScheduleRoutineSheet` promotes a routine into a full scheduled item (stays on page)

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Focus/`

## Notes

- Focus Insights are AI-generated and cached per `week_start_date` — not re-generated on every load.
- Flexible routines share the `items` table; filter carefully.
