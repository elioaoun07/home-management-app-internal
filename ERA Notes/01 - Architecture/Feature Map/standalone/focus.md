# Focus

**Type:** Standalone
**Route:** `/focus`

## What it does

A focus surface — flexible routines (untimed daily todos), insights, and a scheduling sheet for promoting a flexible routine into a scheduled item.

## Files at a glance

- **Page entry**: `src/app/focus/page.tsx`, `src/app/focus/layout.tsx`
- **Components**:
  - `src/components/focus/FocusPage.tsx`
  - `src/components/focus/FlexibleRoutinesPool.tsx`
  - `src/components/focus/ScheduleRoutineSheet.tsx`
- **Hooks**:
  - `src/features/items/useFlexibleRoutines.ts`
  - `src/features/items/useFocusInsights.ts`
- **API routes**: `src/app/api/focus-insights/`
- **DB tables**: items + a flexible-flag column (see `schema.sql`)

## Common edit scenarios

- **"Add a new routine type"** → schema column → hook → `FlexibleRoutinesPool.tsx`.
- **"Edit how routines are scheduled"** → `ScheduleRoutineSheet.tsx` + `useFlexibleRoutines.ts`.

## Connected modules

- **Items & Reminders** — promoting a routine creates an item.
