---
slug: feature-fitness
title: Feature · Fitness
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
---

# Feature · Fitness

> Standalone feature module: Fitness hooks + query keys; domain logic lives in `src/lib/fitness/`.

## Files

- **Module dir**: `src/features/fitness/` (`hooks.ts`, `queryKeys.ts`, `types.ts` re-exports)
- **Shared logic**: `src/lib/fitness/` (`ptPlan.ts` contract, `progress.ts`, `offline.ts`, `contracts.ts`, `format.ts`, `fixtures.ts`, `server.ts`, `types.ts`)

## Hooks

- `useFitnessBundle`, `useFitnessView`, `usePendingFitnessOps`, `useSessionHistory`, `useSessionDetail`, `useImportPlan`, `usePlanAction`, `usePlaceSlot`, `useStartSession`, `useLogSet`, `useClearSet`, `useFinishSession`, `useDeleteSession`, `useResolveHeld`, `useUpdatePreferences`, `useMarkCelebrated`

## API routes

- `/api/fitness/*` — see [[fitness]]

## DB tables

- `fitness_*` (9 tables) — see [[fitness]]

## How to get here

- Used by `src/components/fitness/*` (page `/fitness`).

## What it links to

- [[fitness]]

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Fitness/Overview.md`

## Screenshots

- n/a

## Notes

- Query root `"fitness"` is persisted (STABLE_KEYS) for offline resume.
