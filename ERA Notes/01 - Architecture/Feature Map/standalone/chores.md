# Chores

**Type:** Standalone
**Route:** `/chores` (own page + install identity, 2026-10-03). `/reminders?tab=chores` redirects here; the Reminders "Chores" section button navigates here.

## What it does

Responsive chore agenda: Me | Both | partner tabs, collapsible week strip, focused day on mobile, week overview and planning sidebar on web. Mobile assignment opens in a dialog; longer To plan lists support title search. Completed and Sunday check-in stay collapsed (no Earlier section). Chores are Items with `is_chore = true`; definitions live in Catalogue → **Chores**.

## Files at a glance

- **Page**: `src/app/chores/page.tsx` (mobile; `viewMode === "web"` renders `WebViewContainer initialMode="chores"`), `src/app/chores/layout.tsx` (metadata + manifest)
- **Web shell**: `src/components/web/WebViewContainer.tsx` renders Chores before Budget loading/error gates and forwards `initialChoreDate` to `WebChores`; date links select the same day in both views.
- **Install identity**: `public/manifests/chores.webmanifest` (`id: /chores-app`), `public/chores-icon.svg` → `chores-{180,192,512,maskable-512}.png` via `scripts/generate-icons.cjs`
- **Components** (`src/components/chores/`):
  - `ChoresView.tsx` — responsive agenda, week/day selection, person filter, Library, planning search/sidebar/dialog and action wiring. Also used by desktop `src/components/web/WebChores.tsx`.
  - `ChoreRow.tsx` — slot row: completion button, wrapped title (opens sheet), time and person tag
  - `ChoreTodoRow.tsx` — Unassigned row: tap **Assign** or swipe (left = me, right = partner) → day (preselected from `targetDate`; chips when none) + **All day** or a time ✓
  - `ChoreSwipe.tsx` — Hub-shopping-style swipe: dead zone → follow → lock at 72 px with haptic → commit on release; pointer events + `touch-action: pan-y`. Also wraps scheduled `ChoreRow`s (swipe hands responsibility over)
  - `ChoreSheet.tsx` — responsive detail dialog: move day (flexible), Done, Skip, Postpone (non-flexible), Unassign (flexible), give/take responsibility
  - `ChoreCheckInPanel.tsx` — Sunday check-in (actual completion time / skip reason)
  - `ChorePostponeSheet.tsx`
  - `choreUi.tsx` — tone classes, `PersonTag`, `ChoreDayChips`
- **Model / hooks** (`src/features/chores/`):
  - `choreWeek.ts` — pure week builder (`buildChoreWeek`, `moveDayOptions`, `nextFreeOccurrenceIndex`) + `choreWeek.test.ts`
  - `useChores.ts` — `useChoreWeek(weekOf, templates)`
  - `useChoreActions.ts` — `useChoreSlotActions`, `useChoreAssign`, `useChoreResponsibility`
- **Shared**: `src/lib/schedule/catalogueInstance.ts` (template → one-off item input; also used by `MobileFlexibleAssignmentPage`)
- **API routes**: `src/app/api/items/[id]/complete/route.ts`, `src/app/api/items/[id]/actions/route.ts`
- **DB tables**: `items`, `reminder_details`, `item_occurrence_actions`, `item_flexible_schedules`

## Behavior rules

- Assign places **one occurrence in the selected week**, never a permanent recurrence. Three existing write paths: flexible routine → `item_flexible_schedules` slot; flexible chore template without a routine item → one-off item + push alert at due time; undated one-off → sets `reminder_details.due_at` (no alert added).
- No default time. **All day** / blank time: flexible slot → `scheduled_for_time = null`; one-offs → `due_at` local noon (Schedule's no-time convention) + `items.metadata_json.all_day = true`, and Catalogue instances get no push alert. `isAllDayItem` makes the row show "All day".
- Day chips: past days, days outside the item's period, and days already holding a slot of that chore are disabled. A Mon–Sun week can straddle two monthly periods; each day uses its own period.
- Move = upsert the same slot (item/period/index) to a new day; Undo restores the old day. Unassign deletes only that slot.
- Person filter only filters. Responsibility changes write `items.responsible_user_id` (item-level): a swipe on a routine hands the **whole routine** over (no per-slot owner column); Catalogue instances take the swiped person at creation. Rows are outlined in the owner's person-absolute color.
- Completing writes the actual time to `occurrence_date` and the slot to `metadata_json.planned_for`. No time-spent prompt.

## Common edit scenarios

- **"Change a chore row"** → `ChoreRow.tsx`; **Unassigned/picker** → `ChoreTodoRow.tsx` + `choreUi.tsx`.
- **"Which chores land in a week / what can be assigned"** → `choreWeek.ts` (add a test in `choreWeek.test.ts`).
- **"Edit check-in behavior"** → `ChoreCheckInPanel.tsx` + `useChoreSlotActions`.
- **"Chore definitions"** → Catalogue → Chores (`src/components/web/WebCatalogue.tsx`).

## Connected modules

- **Items / Schedule** — data, occurrence actions, flexible engine (`useFlexibleRoutines`), shared expander (`dayOccurrences`).
- **Catalogue** — Chores section (flagged definitions); templates feed Unassigned.
- **Trips** — trip activation skips recurring chores (`trip_side_effects`).
- **Household Sharing** — person colors and responsibility.
