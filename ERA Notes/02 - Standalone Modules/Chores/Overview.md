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
- Flexible slot writes (`useScheduleRoutine`/`useUnscheduleRoutine`) are direct Supabase calls with no offline queue — failures show "Not saved", never a success toast. Template-created items use the Items offline queue.
- Partner taps on the same chore at the same time compute the same free index → last write wins for that slot (no duplicate).
- Old installs and SW-cached HTML of `/chores` may run the former redirect once after deploy.
- Chores share the `items` table — scope queries with `is_chore`.
- Trips: activation auto-skips recurring chores via `trip_side_effects`; revert un-skips.
- Do not add a time-spent prompt.

## Rooms (2026-10-10)

- **Model:** `home_rooms` (the rooms: name, position, `is_public`, soft-archived; RLS = owner or active household partner when public) + `catalogue_items.room_ids uuid[]` (the rooms a chore template applies to — same array pattern as `item_category_ids`). Migration `2026-10-10_home-rooms.sql` (also seeds the 9 rooms); `2026-10-10_chore-rooms-cleanup.sql` removes the abandoned categories-as-rooms import.
- **One template, many rooms.** "Mop the floor" is one Catalogue template tagged with every room it applies to (Task Template form → **Rooms** chips, with an **All** shortcut and inline add). Catalogue → Chores lists it under each of its rooms; **Rooms** button there renames/deletes/adds rooms.
- **Chores page:** `buildChoreWeek` takes `rooms` and emits one "To plan" to-do per (template, room) — key `tpl:<id>:<roomId>` — grouped under room headers (`ChoreTodo.room/roomId/roomOrder`).
- **Placing a to-do** creates the one-off instance titled `<chore> · <room>` with `items.metadata_json.room_id`; that is how "remaining this period" is counted per room. No column on `items`.
- **Gotchas:** instances copy the room *name* into their title, so renaming a room doesn't retitle existing instances. A room-tagged template is never hidden by a routine item made from it elsewhere (that would silently drop its rooms). Deleting a room archives it; stale ids in `room_ids` are ignored.

## Key Files

See the Feature Map: `ERA Notes/01 - Architecture/Feature Map/standalone/chores.md`.

## See Also

- [[Items & Reminders]] — shared tables, occurrence actions, flexible engine
- [[Catalogue]] — Chores section
- [[Trips]] — chore skip side-effects
- [[Common Patterns]]
