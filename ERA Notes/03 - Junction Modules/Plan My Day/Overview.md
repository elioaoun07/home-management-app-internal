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

> **Module:** `src/features/day-plan/` | **API:** `src/app/api/day-plans/` | **Page:** `src/app/today/`
> **Components:** `src/components/planner/WebDayPlanner.tsx`
> **DB Tables:** `day_plans`
> **Type:** Junction (bridges the new `day_plans` table with the existing Items/Schedule standalone)
> **Status:** Active (phase 1 — triage list only)

## Overview

The Schedule module's three placement strategies — one-time (`reminder_details.due_at` / `event_details.start_at`), recurring (RRULE via `item_recurrence_rules`), and flexible (`item_flexible_schedules`) — work well for a normal routine but break down on **disrupted days**: a wedding this Saturday, a one-day holiday. "Plan My Day" is the dedicated full-page surface (`/today`) for triaging a specific day: see everything landing on it, push items off, pull ("prepone") flexible items from other days onto it, add ad-hoc tasks, and track timed checkpoints.

**Interaction model:** triage-list-first. An hour-by-hour timeline and a mood/energy "rest vs. productivity" optimizer are explicitly deferred to a later phase (see Out of scope).

## Architecture

### Why this is a Junction, not a Standalone

`WebDayPlanner.tsx` imports `useItems`, `useFlexibleRoutines`, and `useItemActions` directly from the Items/Schedule standalone feature directory — something standalone feature dirs are not allowed to do to each other. The new `day_plans` table is the only truly "owned" data; everything else (the items landing on the day) is read live from the existing Schedule module.

### Data flow

1. **"What lands on this day"** — `getOccurrencesForDay(activeItems, selectedDate, occurrenceActions, scheduledFlexible)` from `src/lib/utils/dayOccurrences.ts`. This util was extracted from a local `expandRecurringItems()` that used to live in `WebTodayView.tsx` — both call sites now share one implementation of the flexible-item placement rule (flexible items are skipped inside the RRULE expansion loop and injected separately from `item_flexible_schedules`). **Never reimplement this expansion locally** — any new "what's on day X" view must go through this util or it will silently misplace flexible items.
2. **Flexible items' own period** — `useFlexibleRoutines(activeItems, occurrenceActions, selectedDate)` is called with `selectedDate` as the `referenceDate`. Internally, `fetchFlexibleRoutines()` computes **each item's own** `periodStart`/`periodEnd` from `item.recurrence_rule?.flexible_period`, anchored at `referenceDate` — it is not one shared period across all items. The hook-level `periodStart`/`periodEnd`/`periodLabel` return values are display-only conveniences (based on the "most common period type") and must not be used for placement logic.
3. **Prepone pool (both directions)** — `preponeCandidates = unscheduled flexible items (any slot in the item's own period) + scheduled-elsewhere flexible items (same period, different day)`. Both are pulled onto the selected day via the same `useScheduleRoutine()` upsert (`onConflict: "item_id,period_start_date,occurrence_index"` handles both the insert-new and move-existing cases).
4. **Push off** — one-time/recurring items use `useItemActionsWithToast().handlePostpone` (already has its own toast+Undo, see `useItemActions.ts`). Flexible items use `useUnscheduleRoutine()`, which simply returns the item to its period's "unscheduled" pool — the actual re-placement decision is deferred to whichever day's prepone pool the user visits next, rather than forcing an immediate re-pick.
5. **Checkpoints** — stored as a `jsonb` array directly on the `day_plans` row (no child table), to avoid the hot-child-table RLS concerns in Hard Rule #20 and keep phase 1 simple.

6. **Section defaults** — `WebDayPlanner` opens the "Landing on this day" and "Prepone pool" drawers only when they contain items; empty drawers stay collapsed by default and headers show count badges when there is work to triage.

### The save-gated draft model *(added 2026-06-16)*

The header (title/intent/notes/Private-Shared) and the checkpoint list used to auto-save on every keystroke/click — including a full `POST` on every single Private/Shared toggle. `WebDayPlanner.tsx` now holds these as local draft state (`titleDraft`, `notesDraft`, `intentDraft`, `isPublicDraft`, `checkpointsDraft`) and fires **exactly one `useUpsertDayPlan()` POST**, on explicit **Save**, sending the full draft (including `checkpoints`) in one request.

- **Unplanned day** (`plan === null`) → `mode = "edit"`: a draft form with Save. There is no saved row yet, so there's nothing to cancel back to — Cancel is hidden.
- **Planned day** (`plan` exists) → `mode = "preview"`: a read-only summary card (title, intent badge, notes, Private/Shared badge, checkpoints) with **Edit** (re-seeds drafts from `plan`, switches to edit) and **Delete** (`useDeleteDayPlan()`).
- **Checkpoint done/undone stays live** even in preview — `useCheckpointActions().toggleCheckpoint` still does an immediate `PATCH` with its own Undo toast, since marking something done is a real-time action distinct from editing the plan. Adding/removing a checkpoint, by contrast, only mutates `checkpointsDraft` and is committed on the next Save.
- **Save and Delete always show an Undo toast** (Hard Rule #1) by snapshotting the previous `plan` value before mutating: Save's Undo re-`upsert`s the previous values (or deletes the just-created row if there was no previous plan); Delete's Undo re-`upsert`s the deleted row including its checkpoints.
- The seeding `useEffect` in `WebDayPlanner.tsx` is keyed on `` `${dateStr}:${plan?.id ?? "new"}` `` so it only re-seeds drafts (and resets `mode`) when the date or the saved-plan identity changes — not on every keystroke, and not when a live checkpoint toggle changes `plan.checkpoints`'s array reference behind the scenes.

`POST /api/day-plans` still unconditionally writes `title`/`intent`/`notes` on every call (unlike `is_public`/`checkpoints`, conditionally included only when present) — any partial mutate omitting one of these three will silently null it out. This is no longer a footgun in practice because the only caller is `handleSave`, which always sends the complete draft; any new caller of `useUpsertDayPlan()` must do the same.

## Database

### `day_plans`

One row per `(user_id, plan_date)` — enforced by a `UNIQUE` constraint, which is what makes the upsert idempotent. `intent` (`'rest' | 'balanced' | 'productive'`) is stored now but unused by any optimizer yet — reserved for the deferred mood/energy phase. `checkpoints jsonb` is `[{id, time, label, done_at}]`. `is_public boolean` mirrors the household-visibility pattern used elsewhere (see Hard Rule #13). Partner visibility is enforced by an `EXISTS`-subquery `SELECT` RLS policy on `household_links` (see `day_plans_select` in the migration) — this is deliberate, not an oversight: Hard Rule #20 forbids `EXISTS`-subquery RLS on **hot child tables** re-evaluated per row in a join (`item_alerts`, `item_subtasks`, etc.); `day_plans` is a low-cardinality parent table (one row per user per day, same shape as `items`), so the rule doesn't apply. `supabaseServer()` calls run as the requesting user, so there is no way for the API route to "merge in app code" around RLS — the policy has to let the partner's public row through, or it's invisible no matter what the route does. Insert/update/delete stay owner-only; a public plan is read-only for the partner.

See `migrations/2026-06-16_plan-my-day.sql` for the exact DDL.

## Key Files

- `src/app/today/page.tsx` — thin client page; reads `?date=YYYY-MM-DD` (defaults to today), mounted-guard pattern matches `src/app/chat/page.tsx`
- `src/components/planner/WebDayPlanner.tsx` — the entire UI: day nav, draft form / preview card (title/intent/notes/Private-Shared + checkpoints), landing list, prepone pool, ad-hoc task add. No `layout.tsx` — owns its own `min-h-screen pb-24` / `pt-14`, matching the `/trips` and `/chores` convention (not the `/reminders`/`/chat` `pt-16`-wrapper convention)
- `src/features/day-plan/useDayPlan.ts` — `useDayPlan(date)`, `useUpsertDayPlan()`, `useDeleteDayPlan()`, `useCheckpointActions()` (now just the live `toggleCheckpoint`)
- `src/app/api/day-plans/route.ts` — GET (merges partner's public plan) + POST (upsert by `user_id, plan_date`, called once per Save)
- `src/app/api/day-plans/[id]/route.ts` — PATCH (checkpoint done/undone toggle) + DELETE
- `src/lib/utils/dayOccurrences.ts` — shared occurrence-expansion util, also used by `WebTodayView.tsx`

### Entry points

- `src/components/web/WebTodayView.tsx` — "Plan this day" header link
- `src/components/web/DayExpansionModal.tsx` — "Plan day" header button (web calendar day click)
- `src/components/items/MobileDayExpansionModal.tsx` — "Plan this day" header button (mobile calendar day click, via new `onPlanDay` prop)

## Gotchas

1. **Per-item flexible periods, not one shared period** — see Architecture point 2. A bug here would silently compute the wrong "unscheduled this period" set for items on different flexible-period types (weekly vs. monthly, etc.) within the same prepone pool.
2. **`day_plans` upsert nulls omitted fields** — see "The save-gated draft model" above. Existing API behavior; any new caller of `useUpsertDayPlan()` must resend the full draft (title/intent/notes/is_public/checkpoints), not a partial patch.
3. **`day_plans` partner visibility lives in RLS, not the API route** — the `day_plans_select` policy embeds the `household_links` `EXISTS` check directly (mirrors `items_select`). This is an intentional exception to Hard Rule #20, which targets hot _child_ tables re-evaluated per row in a join, not a low-cardinality parent table like this one. Don't "fix" this by stripping the subquery — without it, the partner's public plan is invisible no matter what the GET route requests.
4. **Don't reach for `upsertDayPlan`/`deleteDayPlan` outside `handleSave`/`handleDelete`/the Undo callbacks** — every other interaction (typing, toggling intent/Private-Shared, add/remove checkpoint) must stay in local draft state (`*Draft` / `checkpointsDraft`) until the user hits Save. Re-wiring any of those onChange handlers back to an immediate mutate reintroduces the per-keystroke API-call bug this model fixed.

## Out of scope (deferred)

- Hourly timeline canvas (drag items into time slots).
- Mood/energy / rest-vs-productivity optimizer that reorders the day from an energy signal — `intent` is stored now so this has a home later; would likely extend `useFocusInsights` or add a new `useDayOptimization` hook.

## See Also

- [[Common Patterns]]
- [[Cache Invalidation]]
