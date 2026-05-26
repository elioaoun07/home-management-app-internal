# Chores

**Type:** Standalone
**Route:** `/chores`

## What it does

Household chores list with grouped views, an "up next" hero, and a postpone sheet. Similar shape to Items & Reminders but its own data layer.

## Files at a glance

- **Page entry**: `src/app/chores/page.tsx`
- **Components**:
  - `src/components/chores/StandaloneChoresPage.tsx`
  - `src/components/chores/UpNextHero.tsx`
  - `src/components/chores/ChoreGroupList.tsx`
  - `src/components/chores/ChoreCard.tsx`
  - `src/components/chores/ChoreActionsSheet.tsx`
  - `src/components/chores/ChorePostponeSheet.tsx`
  - `src/components/chores/ChoresFilterBar.tsx`
  - `src/components/web/WebChores.tsx`
- **Hooks**:
  - `src/features/chores/useChores.ts`
  - `src/features/chores/useChoreActions.ts`
- **API routes**: `src/app/api/chores/` (confirm)
- **DB tables**: `chores` (confirm in `schema.sql`)

## Common edit scenarios

- **"Edit chore card layout"** → `ChoreCard.tsx`.
- **"Change up-next hero"** → `UpNextHero.tsx`.
- **"Edit postpone behavior"** → `ChorePostponeSheet.tsx` + `useChoreActions.ts`.

## Connected modules

- **Notifications** — chore alerts.
- **Household Sharing** — partner sees chores assigned to them.
