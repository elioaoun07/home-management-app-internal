---
slug: feature-chores
title: Feature · Chores
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
---

# Feature · Chores

> Standalone feature module: the pure chore-week model and the hooks behind `/chores`.

## Files

- **Module dir**: `src/features/chores/`
- `choreWeek.ts` (+ `choreWeek.test.ts`)

## Hooks

- `useChores.ts` — `useChoreWeek(weekOf, templates)`
- `useChoreActions.ts` — `useChoreSlotActions`, `useChoreAssign`, `useChoreResponsibility`

## API routes

- `POST /api/items/[id]/complete`, `POST /api/items/[id]/actions` (via Items hooks)

## DB tables

- `items`, `reminder_details`, `item_occurrence_actions`, `item_flexible_schedules`

## How to get here

- Imported by `src/components/chores/*` (rendered at `/chores` and the desktop Chores tab).

## What it links to

- [[chores]]

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Chores/Overview.md`

## Screenshots

- n/a

## Notes

- Still imports Items hooks (`useItems`, `useItemActions`, `useFlexibleRoutines`) — known boundary debt, see SCH-20.
