---
created: 2026-03-23
updated: 2026-06-06
type: overview
module: items
module-type: standalone
tags:
  - type/overview
  - module/items
---

# Items & Reminders — Module Map

> **Source:** `src/features/items/`, `src/app/items/`
> **API:** `src/app/api/items/`
> **DB Tables:** `items`, `item_alerts`, `item_recurrence_rules`, `item_recurrence_exceptions`, `item_occurrence_actions`, `item_flexible_schedules`, `reminder_details`, `event_details`
> **Type:** Standalone

---

## Docs in This Module

- [[Birthday Feature]]

---

## Quick Reference — "Where do I go to…"

| Task | File |
|------|------|
| Create item (mobile quick) | `src/components/reminder/MobileReminderForm.tsx` |
| Create item (mobile full) | ~~`src/components/items/MobileItemForm.tsx`~~ — **dead code (2026-06-06)**, not mounted anywhere; use `MobileReminderForm` |
| Create/edit item (desktop) | `src/components/web/WebEventFormDialog.tsx` |
| Edit existing item | `src/components/items/EditItemDialog.tsx` (opened from detail modal) |
| View/act on an item | `src/components/items/ItemDetailModal.tsx` |
| Complete / postpone / cancel / delete | `src/components/items/ItemActionsSheet.tsx` (via detail modal or swipe) |
| Configure recurrence | `src/components/items/CustomRecurrencePicker.tsx` (inside forms) |
| Configure alerts | `src/components/items/SmartAlertPicker.tsx` (inside forms) |
| Configure prerequisites | `src/components/items/PrerequisitePicker.tsx` (inside forms) |
| See items on a calendar | `src/components/web/WebCalendar.tsx` (full) · `src/components/items/CalendarView.tsx` (compact) |
| See today's items | `src/components/web/WebTodayView.tsx` |
| See items as a timeline list | `src/components/activity/ItemsListView.tsx` |
| See reminders list (standalone) | `src/components/reminder/StandaloneRemindersPage.tsx` |
| Assign flexible routines on mobile | `src/components/planner/MobileFlexibleAssignmentPage.tsx` (`/reminders` Assign tab) |
| CRUD mutations (hooks) | `src/features/items/useItems.ts` |
| Complete/postpone/cancel per-occurrence | `src/features/items/useItemActions.ts` |
| Flexible routines (bi-weekly/weekly) | `src/features/items/useFlexibleRoutines.ts` |
| Focus insights (AI) | `src/features/items/useFocusInsights.ts` |
| Reminder templates | `src/features/items/useReminderTemplates.ts` |

---

## UI Entry Points

### Mobile — Create

| Component | What it does |
|-----------|-------------|
| `src/components/reminder/MobileReminderForm.tsx` | **The live mobile capture form** (mounted in `TabContainer` → `reminder` tab). Smart NL parsing (`src/lib/smartTextParser.ts`), inferred type, voice, categories, dates, recurrence, alerts, prerequisites. **2026-06-06:** title-only "someday" save; quick date chips (Today / Tomorrow / No date); At-Home / Place / Map-link location (`location_context` + `location_text`, replacing the old `metadata_json` location hack for reminders/tasks). |
| `src/components/items/MobileItemForm.tsx` | ⚠️ **Dead code (2026-06-06)** — zero importers; the old 5-step drawer wizard, superseded by `MobileReminderForm`. Slated for removal (campaign file 6, item 5.3). |

### Mobile — View & Act

| Component | What it does |
|-----------|-------------|
| `src/components/items/ItemDetailModal.tsx` | Full-screen detail view — opens on single tap |
| `src/components/items/ItemActionsSheet.tsx` | Bottom sheet: Complete, Postpone, Skip, Flip bi-weekly, Delete |
| `src/components/items/SwipeableItemCard.tsx` | Swipeable card row — swipe right = complete, long-press = actions sheet |

### Desktop — Create & Edit

| Component | What it does |
|-----------|-------------|
| `src/components/web/WebEventFormDialog.tsx` | Primary create/edit dialog for all item types |
| `src/components/items/EditItemDialog.tsx` | Edit-only dialog (opened from ItemDetailModal) |

### Desktop — View

| Component | What it does |
|-----------|-------------|
| `src/components/web/WebCalendar.tsx` | Full month calendar with recurrence expansion, day-expansion modal |
| `src/components/items/CalendarView.tsx` | Compact calendar grid (used inside hub/dashboard) |
| `src/components/web/WebTodayView.tsx` | Today's briefing, TTS support, complete/postpone inline |
| `src/components/web/WebDashboard.tsx` | Hub overview, embeds `ItemsListView` |
| `src/components/web/DayExpansionModal.tsx` | Expanded day view opened from `WebCalendar` |

### Both Viewports

| Component | What it does |
|-----------|-------------|
| `src/components/activity/ItemsListView.tsx` | Timeline list grouped by date — used in activity and hub views |
| `src/components/reminder/StandaloneRemindersPage.tsx` | Standalone reminders list with today/upcoming grouping |
| `src/components/items/ItemDetailModal.tsx` | Single item detail + actions (used on both mobile and desktop) |

---

## Form Sub-Components (used inside create/edit forms)

| Component | Purpose |
|-----------|---------|
| `src/components/items/CustomRecurrencePicker.tsx` | Build RRULE: frequency, interval, until/count |
| `src/components/items/SmartAlertPicker.tsx` | Alert config: absolute/relative, repeat, channels |
| `src/components/items/PrerequisitePicker.tsx` | Trigger conditions: NFC tag, location, other item |
| `src/components/items/ResponsibleUserPicker.tsx` | Assign to household member |
| `src/components/items/CatalogueTemplatePicker.tsx` | Pick a catalogue template to pre-fill the form |
| `src/components/web/EditOccurrenceDialog.tsx` | Edit or skip a single recurrence occurrence |
| `src/components/items/ItemSubtasks.tsx` | Subtask management: kanban, priority, nested |

---

## Recurrence System

Two distinct recurrence modes:

### 1. Fixed-day recurrence (RRule)

Used for items that fire on a specific day (e.g. "every Monday", "every other Thursday").

- **DB:** `item_recurrence_rules` — `rrule` (RRULE part only, no DTSTART), `start_anchor` (timestamptz)
- `start_anchor` IS the DTSTART. Never hardcode DTSTART in the `rrule` field.
- Always build the full iCal string at query time: `buildFullRRuleString(start_anchor, rule)` → `src/lib/utils/date.ts:141`
- Occurrence generation: `RRule.fromString(fullString)` + `RRule.between(start, end)`
- Exceptions: `item_recurrence_exceptions` — an `exdate` entry skips an occurrence; `override_payload_json` overrides it

**To detect bi-weekly:** `item.recurrence_rule.rrule.includes("INTERVAL=2")`

**To reverse a bi-weekly pattern** (flip which weeks are active): shift `start_anchor` by +7 days. Uses `useUpdateRecurrenceRule()` with `start_anchor: addDays(parseISO(current), 7).toISOString()`. The UI button "Flip bi-weekly phase" is in `ItemActionsSheet.tsx` and is visible only for bi-weekly items.

### 2. Flexible routines

Used for items that have a window ("do this sometime this week/bi-week/month") with no fixed day.

- **DB:** `item_recurrence_rules.is_flexible = true`, `flexible_period: "weekly" | "biweekly" | "monthly"`
- `item_flexible_schedules` — records the scheduled day within the period once chosen
- Logic: `src/features/items/useFlexibleRoutines.ts`
- Period boundaries: `getPeriodBoundaries(date, period)` in the same file
- Mobile assignment UI: `src/components/planner/MobileFlexibleAssignmentPage.tsx` is the mobile counterpart to the Web Week flexible catalogue flow. It lists task catalogue templates marked `is_flexible_routine`, calculates the remaining slots for the selected weekly/biweekly/monthly period, and adds one slot to the selected day/time with Undo. If a linked active flexible item already exists, it schedules that routine through `item_flexible_schedules`; otherwise it creates a catalogue-derived calendar item for that period.

---

## Mutation Hooks (`src/features/items/useItems.ts`)

| Hook | Purpose |
|------|---------|
| `useItems(filters?)` | Fetch all items with optional filters |
| `useReminders()` | Fetch reminders only |
| `useEvents()` | Fetch events only |
| `useTasks()` | Fetch tasks only |
| `useItem(id)` | Fetch single item |
| `useCreateReminder()` | Create reminder (optimistic) |
| `useCreateEvent()` | Create event (optimistic) |
| `useCreateTask()` | Create task (optimistic) |
| `useUpdateItem()` | Update base item fields |
| `useUpdateReminderDetails()` | Update reminder-specific fields |
| `useUpdateEventDetails()` | Update event-specific fields |
| `useDeleteItem()` | Delete item |
| `useArchiveItem()` | Archive item |
| `useCompleteReminder()` | Mark reminder as completed |
| `useToggleSubtask()` | Toggle subtask completion |
| `useAddSubtask()` | Add a subtask |
| `useDeleteSubtask()` | Delete a subtask |
| `useUpdateSubtask()` | Update subtask text/priority |
| `useUpdateRecurrenceRule()` | Update or create recurrence rule (pass `start_anchor` to shift phase) |
| `useCreateRecurrenceException()` | Skip or override one occurrence |
| `useDeleteRecurrenceException()` | Remove an exception |
| `useUpdateRecurrenceException()` | Edit an existing exception |

---

## Occurrence Action Hooks (`src/features/items/useItemActions.ts`)

These operate at the **occurrence** level (one instance of a recurring series), not the item level.

| Hook | Purpose |
|------|---------|
| `useItemActionsWithToast()` | Composite: exposes `handleComplete`, `handlePostpone`, `handleCancel`, `handleDelete`, `handleToggleComplete` with built-in toasts and undo |
| `useItemOccurrenceActions(itemId)` | Fetch all actions for one item |
| `useAllOccurrenceActions()` | Fetch all occurrence actions (used in calendar/list rendering) |
| `useCompleteItem()` | Mark an occurrence as completed |
| `useUncompleteItem()` | Uncomplete an occurrence |
| `usePostponeItem()` | Postpone an occurrence |
| `useCancelItem()` | Cancel/skip an occurrence |
| `useDeleteItemWithUndo()` | Delete with undo toast |

Helper functions:
- `isOccurrenceCompleted(actions, itemId, dateStr)` — check if an occurrence was completed
- `getPostponedOccurrencesForDate(actions, date)` — get postponed occurrences for a date
- `normalizeToLocalDateString(isoStr)` — safe date normalization for comparison

---

## API Routes (`src/app/api/items/`)

| Route | Methods | Purpose |
|-------|---------|---------|
| `route.ts` | POST | Create item (used by offline sync replay) |
| `[id]/route.ts` | PATCH, DELETE | Update or delete an item |
| `[id]/complete/route.ts` | POST | Mark item/occurrence as completed |
| `[id]/actions/route.ts` | POST | Record occurrence action (complete/postpone/cancel) |
| `[id]/prerequisites/route.ts` | POST, DELETE | Manage trigger conditions |
| `[id]/promote/route.ts` | POST | Save item as catalogue template |

---

## Hard Rules for This Module

1. **Never use `type="number"` on inputs** — use `type="text"` with `inputMode="decimal"` (prevents iOS scroll-wheel bug)
2. **Recurrence always via `buildFullRRuleString`** — never inline DTSTART inside the `rrule` field; `start_anchor` is the single source of the anchor date
3. **Occurrence actions go to `item_occurrence_actions`** — never mutate the base item to record a single-occurrence skip/complete
4. **All toasts need Undo** — `{ duration: 4000, action: { label: "Undo", onClick: ... } }` per global Hard Rule #1
5. **No red on item rows** — use theme colors (pink/cyan). Container headers can use red/amber. Overdue labels → `text-white/40`
6. **Soft-delete and archive must deactivate `item_alerts`** — FK cascade only fires on hard delete. Both `useArchiveItem` (browser) and `DELETE /api/items/[id]` set `active=false` on pending alerts so the cron stops firing. Cancelling a single occurrence inserts to `item_alert_suppressions` so the cron can suppress that specific occurrence's push.
7. **Alert cron must filter `archived_at IS NULL` AND `deleted_at IS NULL`** — and check `item_occurrence_actions` (cancelled/skipped/completed) and `item_alert_suppressions` before firing. See `src/app/api/cron/item-reminders/route.ts`.
8. **Completing a non-recurring item auto-archives it only if its occurrence date is more than 1 month old** (`ARCHIVE_COMPLETED_OLDER_THAN_MONTHS` in both `[id]/complete/route.ts` and `[id]/actions/route.ts` — keep the constant in sync across both files). Completions within the last month leave `archived_at` untouched so the item still renders with its green strikethrough in `WebCalendar`/`DayExpansionModal`. `useItems()` defaults to `include_archived: false`, so an archived item disappears from every list/calendar entirely — not just from "active" views. Recurring items are unaffected (their completions live in `item_occurrence_actions`, not `archived_at`).

## Reminder list windows (`/reminders`)

**2026-06-19 correction:** the Assign tab is catalogue-first. It shows flexible task templates from `catalogue_items` that are not yet planned for the selected period, then adds one selected day/time slot. Linked active flexible routines are scheduled through `item_flexible_schedules`; otherwise the tab creates a catalogue-derived reminder/task item for that period.

`/reminders` now has `Focus` and `Assign` tabs. Focus is `WebDayPlanner`; the selected day is the primary top panel: it highlights the next item and lists the rest without a collapsible section wrapper. Today is a quick-jump inside the day navigation row. Overdue items are hidden by default and open as their own section from the top Overdue icon; Upcoming (+1d → +7d) is collapsed by default and assignment buckets remain today-only. The Assign tab is `MobileFlexibleAssignmentPage`, a date/time slot picker for flexible routines. The "mine"/"partner" filter operates on `responsible_user_id`, not `user_id` — so an item I own and assign to my partner appears under "partner". Schedule Insights moved to `/dashboard`.

---

## See Also

- [[Notifications Overview]] — item alerts and push notifications
- `ERA Notes/01 - Architecture/Cache Invalidation.md` — query key invalidation patterns
- `ERA Notes/01 - Architecture/Timezone Handling.md` — UTC storage and DST rules
