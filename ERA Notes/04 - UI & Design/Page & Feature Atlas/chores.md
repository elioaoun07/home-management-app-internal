---
slug: chores
title: Chores (merged → /reminders)
category: standalone-page
route: /reminders
type: page
parent: null
children: []
status: active
tags: []
---

# Chores

> Merged into the `/reminders` Chores tab (2026-06-19, between Focus and Assign). The former `/chores` route is now a redirect. Household chore management — Up Next hero, grouped list, quick completion, Sunday check-in for unresolved chores.

## Files

- **Page** (Chores tab): `src/app/reminders/page.tsx`
- **Redirect**: `src/app/chores/page.tsx` → `/reminders?tab=chores`
- **Main component**: `src/components/chores/ChoresTabContent.tsx` (props-driven: `userFilter`, `currentUserId`, `showCompleted` come from the shared Reminders `FilterBar`, not an internal filter bar)
- **Sub-components**:
  - `src/components/chores/UpNextHero.tsx`
  - `src/components/chores/ChoreCard.tsx`
  - `src/components/chores/ChoreGroupList.tsx`
  - `src/components/chores/ChoreCheckInPanel.tsx`
  - `src/components/chores/ChoreActionsSheet.tsx`
  - `src/components/chores/ChorePostponeSheet.tsx`
  - `src/components/web/WebChores.tsx` (separate desktop SPA view inside `WebViewContainer` — untouched by this merge)

## Hooks

- `src/features/chores/useChores.ts` — fetches items where `is_chore = true`
- `src/features/chores/useChoreActions.ts` — complete, skip, postpone, assign

## API routes

- `POST /api/items/[id]/complete` → `src/app/api/items/[id]/complete/route.ts`
- `POST /api/items/[id]/actions` → `src/app/api/items/[id]/actions/route.ts`

## DB tables

- `items` (`is_chore = true`)
- `item_occurrence_actions`
- `reminder_details`

## How to get here

- Default: navigate to `/reminders`, select the Chores tab
- Direct URL: `/reminders?tab=chores`
- Legacy: `/chores` → redirects above

## What it links to

- All interactions are in-page sheets (no child routes).

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Chores/`

## Notes

- Chores are `items` rows — not a separate table. Always scope queries with `is_chore = true`.
- Trip activation auto-skips chores via `trip_side_effects`.
- Sunday check-in is collapsed by default; shows prior-week unresolved chores when expanded.
- The Reminders page's "show completed" eye toggle in the toolbar now also drives the Chores tab's "Done this period" section.
