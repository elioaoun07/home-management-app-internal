---
slug: chores
title: Chores
category: standalone-page
route: /chores
type: page
parent: null
children: []
status: active
tags: []
---

# Chores

> Household chore management — Up Next hero, grouped list, quick completion, Sunday check-in for unresolved chores.

## Files

- **Page**: `src/app/chores/page.tsx`
- **Main component**: `src/components/chores/StandaloneChoresPage.tsx`
- **Sub-components**:
  - `src/components/chores/UpNextHero.tsx`
  - `src/components/chores/ChoreCard.tsx`
  - `src/components/chores/ChoreGroupList.tsx`
  - `src/components/chores/ChoreCheckInPanel.tsx`
  - `src/components/chores/ChoreActionsSheet.tsx`
  - `src/components/chores/ChorePostponeSheet.tsx`
  - `src/components/chores/ChoresFilterBar.tsx`
  - `src/components/web/WebChores.tsx`

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

- ERA nav or direct URL: `/chores`

## What it links to

- All interactions are in-page sheets (no child routes).

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Chores/`

## Notes

- Chores are `items` rows — not a separate table. Always scope queries with `is_chore = true`.
- Trip activation auto-skips chores via `trip_side_effects`.
- Sunday check-in is collapsed by default; shows prior-week unresolved chores when expanded.
