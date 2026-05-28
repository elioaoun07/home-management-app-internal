# Chores

**Type:** Standalone
**Route:** `/chores`

## What it does

Household chores list with grouped views, an "up next" hero, simple completion, and a Sunday check-in for unresolved chores. Chores are stored as Items with `is_chore = true`, but the UX intentionally stays simpler than Schedule tasks/reminders.

## Files at a glance

- **Page entry**: `src/app/chores/page.tsx`
- **Components**:
  - `src/components/chores/StandaloneChoresPage.tsx`
  - `src/components/chores/ChoreCheckInPanel.tsx`
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
- **API routes**:
  - `src/app/api/items/[id]/complete/route.ts`
  - `src/app/api/items/[id]/actions/route.ts`
- **DB tables**: `items`, `reminder_details`, `item_occurrence_actions`

## Behavior rules

- Weekly planning happens through Web Calendar Flexible Items.
- During the week, the primary chore action is completion.
- Mobile chore rows also expose secondary quick actions for postpone, skip, and assign to partner.
- Completing a chore writes the actual completion timestamp to `item_occurrence_actions.occurrence_date`.
- The originally planned slot is preserved in `item_occurrence_actions.metadata_json.planned_for` so check-in logic can resolve the correct weekly chore while analytics can learn when it was actually done.
- Sunday check-in is collapsed by default and shows unresolved chores from the previous week when expanded.
- If the chore was done but not marked, the user supplies the actual completion date/time.
- If the chore was not done, it is stored as `action_type = "skipped"` with a required reason.
- Chores do not prompt for actual minutes/time spent.

## Common edit scenarios

- **"Edit chore card layout"** -> `ChoreCard.tsx`.
- **"Change up-next hero"** -> `UpNextHero.tsx`.
- **"Edit check-in behavior"** -> `ChoreCheckInPanel.tsx` + `useChoreActions.ts`.

## Connected modules

- **Web Calendar** - plans chore instances from Flexible Items.
- **Notifications** - chore alerts.
- **Household Sharing** - partner sees chores assigned to them.
