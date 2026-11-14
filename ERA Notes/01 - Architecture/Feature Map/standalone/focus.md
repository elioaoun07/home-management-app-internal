# Focus

**Type:** Standalone
**Status:** page retired 2026-06-06. There is no `/focus` route, `src/app/focus/` or `src/components/focus/`.
**Vault doc:** `ERA Notes/02 - Standalone Modules/Focus/` (what was retired and why)

## What remains

"Focus" is a per-item action (opens the item's detail view) and the flexible-routines data layer that other surfaces consume.

- **Hooks**:
  - `src/features/items/useFlexibleRoutines.ts`
  - `src/features/items/useFocusInsights.ts`
- **API route**: `src/app/api/focus-insights/`
- **Where flexible routines are placed today**: `src/components/planner/` (see [Plan My Day](../junction/plan-my-day.md)) and the web schedule views in `src/components/web/`

## Common edit scenarios

- **"Change how a flexible routine is scheduled"** → `useFlexibleRoutines.ts`, then the planner component that calls it. Read [Items & Reminders](items-and-reminders.md) first; this is item recurrence territory (`recurrence-safety` skill).
- **"The focus page"** → it no longer exists. Ask which surface is meant: the Schedule Focus tab is [Plan My Day](../junction/plan-my-day.md).

## Connected modules

- **Items & Reminders** — owns the hooks above.
- **Plan My Day** — the surface that places flexible routines into a day.
