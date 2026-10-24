---
created: 2026-05-30
updated: 2026-10-03
type: overview
module: chores
module-type: standalone
status: active
tags:
  - type/overview
  - module/chores
related:
  - "[[Common Patterns]]"
---

# Chores

> **Page:** `src/app/chores/` | **Feature:** `src/features/chores/` | **Components:** `src/components/chores/`
> **DB Tables:** `items` (`is_chore = true`), `item_occurrence_actions`, `reminder_details`, `item_flexible_schedules`
> **Type:** Standalone
> **Route:** `/chores` — own installable app (`/manifests/chores.webmanifest`, id `/chores-app`). `/reminders?tab=chores` redirects here.

## Overview

A responsive household agenda with weekly planning built in. Mobile opens the selected day; web opens a wider week overview with a To plan sidebar. Chores are Items with `is_chore = true`; their reusable definitions are Catalogue items with the same flag (Catalogue → Chores).

History: standalone page (May 2026) → merged into `/reminders` as a tab (2026-06-19) → own page and install identity again (2026-10-03, SCH-20), with the Reminders filter bar, Up Next hero, stats pills and swipe gestures removed.

**Standalone here means** independent navigation, install identity and presentation. Data stays shared: chores read and write the Items tables through the Items hooks.

## Page structure

```
Week dates · previous/next · Library
Mon … Sun                         day/date/remaining counts
Today / Week                      person filter · Assign (mobile)
Selected-day agenda / week overview
Completed / Earlier               collapsed
Sunday check-in                   collapsed
To plan                           desktop sidebar / mobile dialog
```

Day buttons focus the agenda without changing any placement. Today returns to the current day; Week shows the selected week. The compact person filter changes only visibility. **Library** links directly to `/catalogue?section=chores`.

Desktop renders the same `ChoresView` inside the web shell (`WebChores`), with enough width for the agenda and planning sidebar. Mobile opens assignment in a dialog. Longer planning lists have local title search. An Unassigned row still uses Assign → weekday; time stays visible and editable before choosing the day. Rows wrap long titles and retain explicit completion and detail buttons.

`/chores?date=YYYY-MM-DD` selects that date on mobile and web. The web shell renders Chores before its Budget loading/error gates, so an unrelated transaction fetch cannot replace the chore agenda.

Detail and postpone dialogs use the shared accessible Dialog primitive, bottom-aligned on mobile and centered on wider screens. Theme tokens cover blue, pink, frost and calm, including check-in inputs. The redesign adds no scheduling engine or write path.

## Architecture

`useChoreWeek(weekOf, templates)` gathers cached inputs (items, all occurrence actions, flexible schedules) and the shared flexible organizer for the week's Monday and Sunday anchors, then calls the pure `buildChoreWeek`:

| Chore shape | Source of slots | Assign path |
|---|---|---|
| Flexible routine (`recurrence_rule.is_flexible`) | `organizeFlexibleRoutines` scheduled entries | upsert `item_flexible_schedules` at the first free `occurrence_index` |
| Flexible chore template, no routine item | — | create one-off reminder/task + push alert (`buildTemplateInstanceInput`) |
| Fixed recurring | `expandOccurrencesInRange` (shared day expander) | n/a — use Postpone/Skip |
| Dated one-off | `expandOccurrencesInRange` | n/a — use Postpone/Skip |
| Undated one-off (reminder/task) | — | set `reminder_details.due_at` |

Done = completion actions accounted (via `planned_for`) to a day in the week.

## Gotchas

- **Two slots of one chore on the same day are not supported.** The flexible engine matches completions by date, so the picker disables a day the chore already holds.
- **Never reuse a taken `occurrence_index`.** Upserts key on item/period/index; `nextFreeOccurrenceIndex` checks every row in the period (including completed/skipped).
- **A week can straddle two months.** Each day's chip uses the chore's period for that day; moving a slot never crosses its period (period is part of its identity).
- Flexible slot writes (`useScheduleRoutine`/`useUnscheduleRoutine`) are direct Supabase calls with no offline queue — failures show "Not saved", never a success toast. Template-created items use the Items offline queue. **Only the Assign form's template chores use the bulk path** (SCH-25); its flexible-routine and undated entries, and the desktop per-row assign, still write one request at a time (HUB-116 sheets B–C).
- **Bulk save needs the SCH-25 migration** (`2026-10-17_items-bulk-create.sql`). Without it the server answers 501, Save reports "N not saved" and restages the chores — nothing queues or duplicates. Queued rows (offline/slow server) show on the agenda only in the session that saved them until the queue syncs.
- Partner taps on the same chore at the same time compute the same free index → last write wins for that slot (no duplicate).
- Old installs and SW-cached HTML of `/chores` may run the former redirect once after deploy.
- Chores share the `items` table — scope queries with `is_chore`.
- Trips: activation auto-skips recurring chores via `trip_side_effects`; revert un-skips.
- Do not add a time-spent prompt.

## Rooms (2026-10-10)

- **Model:** `home_rooms` (the rooms: name, position, `is_public`, soft-archived; RLS = owner or active household partner when public) + `catalogue_items.room_ids uuid[]` (the rooms a chore template applies to — same array pattern as `item_category_ids`). Migration `2026-10-10_home-rooms.sql` (also seeds the 9 rooms); `2026-10-10_chore-rooms-cleanup.sql` removes the abandoned categories-as-rooms import.
- **One template, many rooms.** "Mop the floor" is one Catalogue template tagged with every room it applies to (dedicated chore form `ChoreItemDialog.tsx` → **Rooms** chips, with an **All** shortcut and inline add; opened by Catalogue → Chores → +, and by editing any `is_chore` item. The generic Task Template form no longer has chore fields). Catalogue → Chores lists it under each of its rooms; **Rooms** button there renames/deletes/adds rooms.
- **Chores page:** `buildChoreWeek` takes `rooms` and emits one "To plan" to-do per (template, room) — key `tpl:<id>:<roomId>` — grouped under room headers (`ChoreTodo.room/roomId/roomOrder`).
- **Placing a to-do** creates the one-off instance titled `<chore> · <room>` with `items.metadata_json.room_id`; that is how "remaining this period" is counted per room. No column on `items`.
- **Per-room checklist:** `catalogue_items.room_config jsonb` = `{ <roomId>: { checklist, minutes } }` (migration `2026-10-10_chore-room-config.sql`). One template ("Tidy & Organize") carries different steps per room; `buildTemplateInstanceInput` uses the room's checklist as the instance subtasks and the room's minutes as the estimate, else the template's. Separate templates only when cadence differs (oven vs toilet). A per-room default assignee would live in the same map (not built).
- **Same for all / Per room:** the chore form's toggle. Same-for-all uses the template's Minutes + Steps for every room; Per room shows a card per ticked room (saving in Same-for-all mode clears `room_config`).
- **Default owner:** `catalogue_items.default_assignee_id` (migration `2026-10-10_chore-default-assignee.sql`; NULL = anyone). `choreWeek` sets the template to-do's `responsibleUserId` from it, so the row is outlined in that person's colour and placing it only needs the day; a swipe still overrides. The form's Household switch is gone: new chores are created shared (`is_public`), edits leave visibility alone.
- **Assign form (mobile + Assign dialog):** `ChoreAssignPanel.tsx`. Rooms tab = gradient tiles (`ChoreRoomTile`, look per room in `roomStyle.tsx`, same language as Trips packing) with done · assigned · to-plan counts (`roomStats.ts`); Chores tab = one accordion per chore across rooms. Both have a bulk bar (day chips + Me/partner) to stage every chore in the room / every room of the chore at once; rows stage one by one (quick "+ day" chip for the agenda day, day chips, optional time, swipe for person). **Nothing is written until Save** (`useChoreDrafts` in ChoresView): Save closes at once and `placeTemplates` hands the whole batch to the shared bulk path (`createItemsBulk`, SCH-25) — the rows are on the agenda before the first request, go out as at most 25-item idempotent requests (or wait in the offline queue as one operation), with one toast + one Undo (one bulk delete); anything the server refuses goes back into the form. Closing with staged changes asks Discard / Keep / Save. The desktop "To plan" aside keeps the immediate per-row assign and shows no counts.
- **Mobile UX (2026-10-24):** Rooms/Chores tabs stay visible inside a room (last tab per device, `chores.assignTab`); a search box matches chore + room names and shows a flat result list with its own "Assign all N shown" (drafts hidden by the search stay staged); bulk bars are labelled "Assign all N"; an open row has a Me/partner selector (swipe remains); the dialog has a fixed mobile height; the agenda toggle reads "Group".
- **Defaults and extras (2026-10-24, SCH-29):** the page opens on **Me** and **Group** (key `chores.groupByChore.v2`). The Assign form receives the unfiltered week (the person is picked inside it), hides chores already on the day it was opened for, and each Chores-tab header has Me / partner buttons: one tap stages every room on that day for that person (again = take back); the bulk bars' person buttons do the same. A **met target never blocks**: `buildChoreWeek` keeps the to-do as `extra` (not counted as "to plan", not swept by bulk) and flags days `over`; a placement beyond target gets `ChoreSlot.over` → amber `rank/target` tag on `ChoreRow`/`ChoreGroupRow`. **Any time** chores (Catalogue form, `is_flexible_routine = false`, no `recurrence_pattern`) are offered every week with no counter (`anytime`). Pre-existing chore templates saved with no recurrence now surface as Any time.
- **Optimistic writes (2026-10-24, SCH-30):** Done / Reopen of one slot (row, sheet, check-in) use the bulk-complete path with one entry — the row flips first, retries are idempotent, offline queues one operation, Undo reverses it; a second tap on an item still going out is ignored. A routine's slot write / move / unassign patch the `item_flexible_schedules` cache first (`upsertScheduleRow`, `removeScheduleRows`) and refetch if the write fails. The desktop per-row Assign uses the bulk create. Still plain mutations: Skip, Postpone, one-off Unassign, undated placement (HUB-116).
- **Gotchas:** instances copy the room *name* into their title, so renaming a room doesn't retitle existing instances. A room-tagged template is never hidden by a routine item made from it elsewhere (that would silently drop its rooms). Deleting a room archives it; stale ids in `room_ids` are ignored.

## Group by chore (2026-10-20, SCH-26)

- The **Layers** toggle beside Today/Week (per device, `localStorage` `chores.groupByChore`) groups the open agenda: slots of the same Catalogue template on the same day (two or more) become one `ChoreGroupRow` — template name, "N rooms", shared time/owner. Its check completes every open room; tapping the row expands the per-room rows (each keeps its own check and sheet). Completed stays per room.
- **Write path:** one `POST /api/items/bulk/complete` (≤50 entries, per-entry outcome) via `bulkComplete.ts` — rows show done before the request, slow requests retry the same idempotent body, an unreachable network queues one operation, refused rooms reopen alone. Undo = one `DELETE` on the same route. Server logic is `completeItemForUser` (`src/lib/items/completeItems.ts`), shared with the single complete route, so per-item effects (archive, alerts off, prerequisite reset, Google backup) are identical.
- **Gotcha:** if any room belongs to the partner, the group asks for Override once (same guard as a single completion). Grouping keys on `source_catalogue_item_id`, so routine items and hand-made chores never group.

## Key Files

See the Feature Map: `ERA Notes/01 - Architecture/Feature Map/standalone/chores.md`.

## See Also

- [[Items & Reminders]] — shared tables, occurrence actions, flexible engine
- [[Catalogue]] — Chores section
- [[Trips]] — chore skip side-effects
- [[Common Patterns]]
