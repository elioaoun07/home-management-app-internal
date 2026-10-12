---
slug: fitness
title: Fitness
category: standalone-page
route: /fitness
type: page
parent: null
children: []
status: active
tags:
  - module/fitness
---

# Fitness

> Imported PT plans, workout logging with rest timer, deterministic rewards around an animated progression core, and Healthcare weight/height/BMI.

## Files

- **Page**: `src/app/fitness/page.tsx` (+ `layout.tsx` metadata) → `FitnessClient.tsx` (Suspense)
- **Main component**: `src/components/fitness/FitnessPage.tsx` (tabs Today | Plan | Quests | Progress, settings menu, held-conflict review, fixture mode)
- **Sub-components** (`src/components/fitness/`): `TodayTab`, `PlanTab`, `QuestsTab`, `ProgressTab`, `WorkoutScreen` (portaled full-screen), `ProgressCore`, `Celebration`, `ImportSheet`, `PlaceSheet`, `FitnessIcons`, `fitnessUi`, `fitnessTheme`; shared `src/components/health/MeasurementsCard.tsx`

## Hooks

- `src/features/fitness/hooks.ts` — `useFitnessView` (bundle + offline overlay), plan/session/placement/preference mutations (safeFetch, real-inverse Undo toasts, IndexedDB queue when confirmed offline)
- `src/hooks/useHealthMeasurements.ts` — shared with Healthcare

## API routes

- `/api/fitness` (GET bundle) · `/api/fitness/plans` (POST import) · `/api/fitness/plans/[id]` (POST action)
- `/api/fitness/sessions` (GET history, POST op) · `/api/fitness/sessions/[id]` · `/api/fitness/slots/[id]/placement` (PUT)
- `/api/fitness/preferences` (PATCH) · `/api/fitness/rewards/seen` (POST) · `/api/fitness/operations/[id]` (GET receipt)
- `/api/healthcare/measurements` (GET/POST) · `/api/healthcare/measurements/[id]` (PATCH/DELETE)

## DB tables

- `fitness_plans`, `fitness_plan_versions`, `fitness_plan_slots`, `fitness_plan_pauses`, `fitness_sessions`, `fitness_set_logs`, `fitness_reward_events`, `fitness_preferences`, `fitness_operations`, `health_measurements` (+ Schedule `items` / `item_flexible_schedules` / `item_occurrence_actions`)

## How to get here

- Direct URL `/fitness`; ERA "open fitness / workout / gym". Standalone shell (registered in `MobileNav.standaloneRoutes` and `ConditionalHeader.STANDALONE_APPS`).
- Deep links: `?tab=plan|quests|progress`, `?w=1` (open the unfinished workout). Dev only: `?fixture=empty|active|week|rankup`.

## What it links to

- Schedule (slot items appear as weekly flexible routines; completion is shared) · Healthcare (same measurement records) · partner summary (opt-in)

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Fitness/Overview.md`

## Screenshots

- `fitness-mobile.png`
- `fitness-desktop.png`

## Notes

- Synthetic fixtures (`src/lib/fitness/fixtures.ts`) are display-only and never touch the network.
