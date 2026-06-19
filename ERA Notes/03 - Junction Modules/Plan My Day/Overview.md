---
created: 2026-06-16
type: feature-doc
module: plan-my-day
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/plan-my-day
related:
  - "[[Common Patterns]]"
  - "[[Cache Invalidation]]"
---

# Plan My Day

> **Module:** `src/features/day-plan/` | **API:** `src/app/api/day-plans/` | **Page:** merged into `src/app/reminders/` (Focus tab); `src/app/today/` is a redirect to `/reminders?date=…&plan=1`
> **Components:** `src/components/planner/WebDayPlanner.tsx`
> **DB Tables:** `day_plans`
> **Type:** Junction (bridges `day_plans` with Items/Schedule; now also owns the /reminders Focus view, replacing the retired `StandaloneRemindersPage`)
> **Status:** Active *(IMPLEMENTED 2026-06-17: merged with /reminders — see plan `going-back-to-the-linked-deer`)*

## Overview

The Schedule module's three placement strategies — one-time (`reminder_details.due_at` / `event_details.start_at`), recurring (RRULE via `item_recurrence_rules`), and flexible (`item_flexible_schedules`) — work well for a normal routine but break down on **disrupted days**: a wedding this Saturday, a one-day holiday. "Plan My Day" is now merged into the `/reminders` page as the **Focus tab** (`WebDayPlanner.tsx`). By default it shows the selected day's scheduled items. The sticky top action row exposes **Plan my day** as an icon beside filters/refresh; Today lives inside the day navigation controls. The former standalone `/today` route is a redirect and `StandaloneRemindersPage` is deleted.

**Three UI states:**
- **Browsing** (no plan yet): day nav + a primary selected-day panel that highlights the next item and lists the rest. Upcoming/assignment drawers remain today-only. Overdue is hidden by default and opens as its own section when the top Overdue icon is enabled.
- **Planning** (button pressed or editing an existing plan): title/intent/notes/Private-Shared header + Prepone pool + Checklist editor (dnd-kit drag-to-reorder, untimed) + ad-hoc task add. Saves in one POST on "Save day plan".
- **Preview** (plan exists, not editing): plan summary card (title/intent/notes, public badge) with the checklist nested inside (live check-off via PATCH). Edit/Delete buttons.

**Interaction model:** triage-list-first. An hour-by-hour timeline and a mood/energy optimizer are explicitly deferred (see Out of scope).

## Architecture

### Why this is a Junction, not a Standalone

`WebDayPlanner.tsx` imports `useItems`, `useFlexibleRoutines`, and `useItemActions` directly from the Items/Schedule standalone feature directory — something standalone feature dirs are not allowed to do to each other. The new `day_plans` table is the only truly "owned" data; everything else (the items landing on the day) is read live from the existing Schedule module.

### Data flow

1. **"What lands on this day"** — `getOccurrencesForDay(activeItems, selectedDate, occurrenceActions, scheduledFlexible)` from `src/lib/utils/dayOccurrences.ts`. This util was extracted from a local `expandRecurringItems()` that used to live in `WebTodayView.tsx` — both call sites now share one implementation of the flexible-item placement rule (flexible items are skipped inside the RRULE expansion loop and injected separately from `item_flexible_schedules`). **Never reimplement this expansion locally** — any new "what's on day X" view must go through this util or it will silently misplace flexible items.
2. **Flexible items' own period** — `useFlexibleRoutines(activeItems, occurrenceActions, selectedDate)` is called with `selectedDate` as the `referenceDate`. Internally, `fetchFlexibleRoutines()` computes **each item's own** `periodStart`/`periodEnd` from `item.recurrence_rule?.flexible_period`, anchored at `referenceDate` — it is not one shared period across all items. The hook-level `periodStart`/`periodEnd`/`periodLabel` return values are display-only conveniences (based on the "most common period type") and must not be used for placement logic.
3. **Prepone pool (both directions)** — `preponeCandidates = unscheduled flexible items (any slot in the item's own period) + scheduled-elsewhere flexible items (same period, different day)`. Both are pulled onto the selected day via the same `useScheduleRoutine()` upsert (`onConflict: "item_id,period_start_date,occurrence_index"` handles both the insert-new and move-existing cases).
4. **Push off** — one-time/recurring items use `useItemActionsWithToast().handlePostpone` (already has its own toast+Undo, see `useItemActions.ts`). Flexible items use `useUnscheduleRoutine()`, which simply returns the item to its period's "unscheduled" pool — the actual re-placement decision is deferred to whichever day's prepone pool the user visits next, rather than forcing an immediate re-pick.
5. **Checkpoints** — stored as a `jsonb` array directly on the `day_plans` row (no child table), to avoid the hot-child-table RLS concerns in Hard Rule #20 and keep phase 1 simple.

6. **Section defaults** — `WebDayPlanner` keeps the selected-day panel always visible; it is not a collapsible section. Upcoming (+1d → +7d) is collapsed by default. The Prepone pool opens only when it contains items. Overdue is a separate today-only section controlled by `/reminders/page.tsx` through the top Overdue icon.

7. **Mobile flexible assignment** — `/reminders` also has an `Assign` tab (`MobileFlexibleAssignmentPage.tsx`). It reuses `useFlexibleRoutines`, `useScheduleRoutine`, and `useUnscheduleRoutine` to provide a simpler mobile slot picker: choose a day/time once, then assign or move flexible routines into that calendar slot with Undo.

**2026-06-19 correction:** mobile Assign is catalogue-first. It lists task catalogue templates marked `is_flexible_routine`, computes remaining slots for the selected period, and adds a selected day/time slot. It uses `useScheduleRoutine` only when a linked active flexible routine already exists; otherwise it creates a catalogue-derived reminder/task item for the period.

### The save-gated draft model *(added 2026-06-16, updated 2026-06-17)*

The header (title/intent/notes/Private-Shared) and the checklist hold their edits as local draft state (`titleDraft`, `notesDraft`, `intentDraft`, `isPublicDraft`, `checklistDraft`) and fire **exactly one `useUpsertDayPlan()` POST**, on explicit **Save day plan**, sending the full draft in one request.

- **Browsing** (`plan === null`, default) → no plan form visible; the top Plan icon enters planning.
- **Planning** (`plan` exists or the top Plan icon is clicked) → full planning editor with Save/Cancel. Cancel reverts to Preview if a plan exists, or back to Browsing if no plan yet.
- **Preview** (`plan` exists, not editing) → summary card (title/intent/notes, public badge, checklist) with **Edit** (pencil) and **Delete** (trash) buttons.
- **Checklist check-off stays live** even in preview — `useChecklistActions().toggleChecklistItem` still does an immediate `PATCH` with its own Undo toast. Adding/removing/reordering checklist items only mutates `checklistDraft` and commits on Save.
- **URL-driven auto-open-planning** (`?plan=1`): handled by a second `useEffect` declared after the main seeding effect, gated on `dayPlanLoading === false` and consumed exactly once per mount (via `initialPlanningConsumedRef`). This prevents the auto-open from being clobbered by the seeding effect once real plan data arrives.
- **Save and Delete always show an Undo toast** (Hard Rule #1). Save's Undo re-`upsert`s the previous values (or deletes the just-created row if there was no previous plan); Delete's Undo re-`upsert`s the deleted row including its checklist.
- The seeding `useEffect` is keyed on `` `${dateStr}:${plan?.id ?? "new"}` `` so it re-seeds only when the date or saved-plan identity changes — not on every keystroke, and not when a live checklist toggle changes `plan.checklist`'s array reference.

`POST /api/day-plans` still unconditionally writes `title`/`intent`/`notes` on every call (unlike `is_public`/`checkpoints`, conditionally included only when present) — any partial mutate omitting one of these three will silently null it out. This is no longer a footgun in practice because the only caller is `handleSave`, which always sends the complete draft; any new caller of `useUpsertDayPlan()` must do the same.

## Database

### `day_plans`

One row per `(user_id, plan_date)` — enforced by a `UNIQUE` constraint. `intent` (`'rest' | 'balanced' | 'productive'`) is stored now, reserved for the deferred mood/energy phase. `checklist jsonb` is `[{id, label, done_at, sort_order}]` — no `time` field; items are ordered by `sort_order` (drag-to-reorder in planning mode). `is_public boolean` mirrors household-visibility elsewhere (Hard Rule #13). Partner visibility is enforced by an `EXISTS`-subquery RLS policy on `household_links` (`day_plans_select` in the migration) — deliberate exception to Hard Rule #20, which targets hot _child_ tables, not this low-cardinality parent table.

See `migrations/2026-06-16_plan-my-day.sql` (original DDL) and `migrations/2026-06-17_day-plan-checklist.sql` (rename `checkpoints` → `checklist`, shape transform).

## Key Files

- `src/app/reminders/page.tsx` — Focus tab renders `WebDayPlanner`; reads `?date=` + `?plan=1` from URL (via `useSearchParams`), cleans params via `history.replaceState`
- `src/app/today/page.tsx` — redirect-only; immediately navigates to `/reminders?date=…&plan=1` to preserve old links / PWA shortcuts
- `src/components/planner/WebDayPlanner.tsx` — the merged surface: day nav, three-state model (browsing/planning/preview), selected-day panel with next-item focus, separate Overdue/Upcoming/Assigned sections (today only), prepone pool, checklist editor (dnd-kit drag-to-reorder), ad-hoc task add, `ItemDetailModal` + `ItemActionsSheet` wiring
- `src/components/planner/MobileFlexibleAssignmentPage.tsx` — `/reminders` Assign tab for mobile-friendly flexible catalogue routine assignment
- `src/features/day-plan/useDayPlan.ts` — `useDayPlan(date)`, `useUpsertDayPlan()`, `useDeleteDayPlan()`, `useChecklistActions()` (live `toggleChecklistItem` PATCH)
- `src/app/api/day-plans/route.ts` — GET (merges partner's public plan) + POST (upsert by `user_id, plan_date`, once per Save)
- `src/app/api/day-plans/[id]/route.ts` — PATCH (checklist item done/undone) + DELETE
- `src/lib/utils/dayOccurrences.ts` — shared occurrence-expansion util; never reimplement locally

### Entry points

- `src/components/web/WebTodayView.tsx` — "Plan this day" link → `/reminders?date=…&plan=1`
- `src/components/web/WebCalendar.tsx` — `onPlanDay` callback → `/reminders?date=…&plan=1` (passes to `DayExpansionModal`)
- `src/components/items/CalendarView.tsx` — `onPlanDay` callback → `/reminders?date=…&plan=1` (passes to `MobileDayExpansionModal`)

## Gotchas

1. **Per-item flexible periods, not one shared period** — see Architecture point 2. A bug here would silently compute the wrong "unscheduled this period" set for items on different flexible-period types (weekly vs. monthly, etc.) within the same prepone pool.
2. **`day_plans` upsert nulls omitted fields** — see "The save-gated draft model" above. Existing API behavior; any new caller of `useUpsertDayPlan()` must resend the full draft (title/intent/notes/is_public/checkpoints), not a partial patch.
3. **`day_plans` partner visibility lives in RLS, not the API route** — the `day_plans_select` policy embeds the `household_links` `EXISTS` check directly (mirrors `items_select`). This is an intentional exception to Hard Rule #20, which targets hot _child_ tables re-evaluated per row in a join, not a low-cardinality parent table like this one. Don't "fix" this by stripping the subquery — without it, the partner's public plan is invisible no matter what the GET route requests.
4. **Don't reach for `upsertDayPlan`/`deleteDayPlan` outside `handleSave`/`handleDelete`/the Undo callbacks** — every other interaction (typing, toggling intent/Private-Shared, add/remove/reorder checklist item) must stay in local draft state (`*Draft` / `checklistDraft`) until the user hits Save. Re-wiring any of those onChange handlers back to an immediate mutate reintroduces the per-keystroke API-call bug this model fixed.

## Out of scope (deferred)

- Hourly timeline canvas (drag items into time slots).
- Mood/energy / rest-vs-productivity optimizer that reorders the day from an energy signal — `intent` is stored now so this has a home later; would likely extend `useFocusInsights` or add a new `useDayOptimization` hook.

## See Also

- [[Common Patterns]]
- [[Cache Invalidation]]
