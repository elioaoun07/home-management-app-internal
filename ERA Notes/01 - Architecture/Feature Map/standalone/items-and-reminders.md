# Items & Reminders (Schedule)

**Type:** Standalone
**Routes:** `/reminders`, `/alerts` (`/today` is a redirect to `/reminders?plan=1`)
**Vault doc:** `ERA Notes/02 - Standalone Modules/Items & Reminders/`

## What it does

The Schedule module covers everything time-bound: reminders, tasks, events, recurring routines, and alerts. An "item" is the unifying record (`items` table) with detail rows in `reminder_details`, `event_details`, `item_subtasks`, `item_alerts`, `item_recurrence_rules`. The view modes are: schedule list, calendar, today.

## Files at a glance

- **Page entries**:
  - `src/app/reminders/page.tsx`, `src/app/reminders/layout.tsx` - Focus tab renders `WebDayPlanner` (merged planner/reminders); Assign tab renders `MobileFlexibleAssignmentPage`; Schedule Insights moved to `/dashboard`
  - `src/app/today/page.tsx` - redirect only (to `/reminders?date=...&plan=1`)
  - `src/app/alerts/page.tsx`
  - **2026-06-19 update:** `/reminders` now has `Focus` + `Assign`; Schedule Insights moved to `/dashboard`.
- **Standalone container** (Focus tab removed; now `WebDayPlanner`):
  - `src/components/reminder/RemindersInsightsPage.tsx`
  - `src/components/reminder/ReminderTagsBar.tsx` / `ReminderTagsBarWrapper.tsx`
- **Item entry forms (the thing you usually want to edit)**:
  - `src/components/reminder/MobileReminderForm.tsx` - live mobile entry form (mounted in `TabContainer` -> `reminder` tab; smart NL via `src/lib/smartTextParser.ts`)
  - `src/components/items/MobileItemForm.tsx` - dead code (2026-06-06); zero importers, not mounted; superseded by `MobileReminderForm`
  - `src/components/items/EditItemDialog.tsx` - edit existing item
  - `src/components/items/EditScopeDialog.tsx` - "edit this one / all future / all" for recurring
  - `src/components/items/RecurringEditChoiceDialog.tsx`
- **Views**:
  - `src/components/planner/WebDayPlanner.tsx` - `/reminders` Focus tab; selected-day planning and today list
  - `src/components/planner/MobileFlexibleAssignmentPage.tsx` - `/reminders` Assign tab; starts from task catalogue templates marked `is_flexible_routine`; linked active flexible routines use `item_flexible_schedules`, otherwise a catalogue-derived calendar item is created for the selected period
  - `src/components/items/ScheduleView.tsx`
  - `src/components/items/CalendarView.tsx`
  - `src/components/items/ItemsDashboard.tsx`
  - `src/components/items/MobileDayExpansionModal.tsx`
- **Cards / rows / actions**:
  - `src/components/items/SwipeableItemCard.tsx`
  - `src/components/items/ItemDetailModal.tsx`
  - `src/components/items/ItemActionsSheet.tsx`
- **Pickers**:
  - `src/components/items/CustomRecurrencePicker.tsx`
  - `src/components/items/SmartAlertPicker.tsx`
  - `src/components/items/ResponsibleUserPicker.tsx`
  - `src/components/items/PrerequisitePicker.tsx`
  - `src/components/items/CatalogueTemplatePicker.tsx`
  - `src/components/items/PromoteToCatalogueDialog.tsx`
- **Subtasks (desktop / web)**:
  - `src/components/web/ItemSubtasks.tsx`
- **Hooks (data + mutations)**:
  - `src/features/items/useItems.ts` - primary list + bundle reader
  - `src/features/items/useItemActions.ts` - create / update / delete / complete
  - `src/features/items/useFlexibleRoutines.ts`
  - `src/features/items/useReminderTemplates.ts`
  - `src/features/items/useFocusInsights.ts`
  - `src/features/catalogue/hooks.ts` - catalogue templates used by mobile Assign
- **API routes (under `src/app/api/items/`)**:
  - `route.ts` - list + create
  - `[id]/route.ts` - update + delete + complete
  - `[id]/prerequisites/route.ts` - see [../junction/prerequisites.md](../junction/prerequisites.md)
  - `[id]/subtasks/route.ts` (under `src/app/api/subtasks/`)
  - `src/app/api/reminder-templates/`
  - `src/app/api/suggest-schedule/`
- **DB tables**: `items`, `catalogue_items`, `reminder_details`, `event_details`, `item_subtasks`, `item_alerts`, `item_recurrence_rules`, `item_flexible_schedules`, `item_recurrence_exceptions`, `recurrence_pauses`
- **Hot-path RPC**: `get_schedule_bundle` (SECURITY DEFINER, returns parent + all children as JSON aggregates in a single call - see Hard Rule #21)

## Common edit scenarios

- **"Change the Schedule item entry form"**:
  1. Open `src/components/items/MobileItemForm.tsx` (mobile) or `src/components/reminder/MobileReminderForm.tsx` if reminder-specific.
  2. If adding a new field: update the API zod schema in `src/app/api/items/route.ts`, the DB column in `migrations/schema.sql`, the `get_schedule_bundle` RPC if it should be read on hot path, the TS type, and `useItemActions.ts`.
- **"Edit mobile flexible catalogue assignment"** -> `src/components/planner/MobileFlexibleAssignmentPage.tsx`; compare desktop behavior in `src/components/web/AddFlexibleFromCatalogueDialog.tsx`, `src/components/web/CatalogueSidePanel.tsx`, and `src/components/web/DropSlotConfigSheet.tsx`.
- **"Edit the recurrence picker"** -> `src/components/items/CustomRecurrencePicker.tsx`. RRULE storage is in `item_recurrence_rules`.
- **"Edit how alerts work"** -> `src/components/items/SmartAlertPicker.tsx` for UI; alert delivery is in [../junction/notifications.md](../junction/notifications.md).
- **"Change schedule view list rendering"** -> `src/components/items/ScheduleView.tsx`. Calendar variant -> `CalendarView.tsx`.
- **"Item swipe actions"** -> `src/components/items/SwipeableItemCard.tsx`. Tap menu -> `ItemActionsSheet.tsx`.
- **"Edit one occurrence of a recurring item"** -> `src/components/items/EditScopeDialog.tsx` is the chooser; `item_recurrence_exceptions` row is what gets written.
- **"Add a subtask UI"** -> `src/components/web/ItemSubtasks.tsx`; API in `src/app/api/subtasks/`.

## Gotchas

- **Read `migrations/schema.sql`** for items first; it has 7+ child tables and column meanings are not obvious.
- **Never** add `EXISTS`-subquery RLS to child tables (`item_alerts`, `item_subtasks`, etc.). Use `get_schedule_bundle` or a denormalized `user_id` column with a direct RLS policy. See Hard Rule #20.
- The hot read path is **one RPC call**, not 7 queries. Do not fan out reads; extend the RPC.
- All date/time handling is UTC at rest; see `.claude/skills/timezone-handling/` and `src/lib/utils/date.ts` (RRule + DTSTART rules).
- Toasts must include Undo (Hard Rule #1).
- Theme colors only; no red on individual item rows (Hard Rule #3).

## Connected modules

- **Catalogue** ([./catalogue.md](./catalogue.md)) - promote items to template, instantiate from template.
- **Notifications** ([../junction/notifications.md](../junction/notifications.md)) - push delivery, cron alerts.
- **Hub Chat -> Message Actions** ([../junction/message-actions.md](../junction/message-actions.md)) - chat -> create reminder.
- **Prerequisites** ([../junction/prerequisites.md](../junction/prerequisites.md)) - dormant items waiting on NFC / location triggers.
- **AI Assistant** ([../junction/ai-assistant.md](../junction/ai-assistant.md)) - voice "remind me to..." intent.
- **Focus** ([./focus.md](./focus.md)) - flexible routines feed off `useFlexibleRoutines.ts`.
