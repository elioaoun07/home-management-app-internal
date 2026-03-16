# Budget + Reminder App Merge

This document describes the architecture and implementation of merging the Reminder App into the Budget App.

## Overview

The Budget App has been enhanced to include the Reminder/Events/Notes functionality from the Reminder App. Both features now coexist in a single unified application.

## Architecture

### Database Schema

A new migration (`migrations/add_items_system.sql`) adds the following tables:

- `items` - Core table for reminders, events, and notes
- `item_categories` - User-defined categories for organizing items
- `item_category_mappings` - Junction table linking items to categories
- `reminder_details` - Additional data for reminder items (due date, completion status)
- `event_details` - Additional data for event items (start/end time, location, all-day)
- `item_subtasks` - Checklist items for reminders
- `item_alerts` - Notification alerts for items
- `item_snoozes` - Snooze records for alerts
- `item_recurrence_rules` - Recurrence patterns for repeating items
- `item_recurrence_exceptions` - Exceptions to recurrence rules
- `item_attachments` - File attachments for items
- `item_alert_presets` - User-defined alert templates

All tables have proper:

- Row Level Security (RLS) policies
- Foreign key constraints with CASCADE delete
- Indexes for common queries
- Updated_at triggers

### TypeScript Types

Located in `src/types/items.ts`:

- `Item`, `ItemWithDetails` - Core item types
- `ItemCategory`, `Subtask`, `ItemAlert` - Related entity types
- `CreateReminderInput`, `CreateEventInput`, `CreateNoteInput` - Creation inputs
- `UpdateReminderInput`, `UpdateEventInput` - Update inputs
- Priority and Status enums with theme-aware colors

### Context & State Management

**AppModeContext** (`src/contexts/AppModeContext.tsx`):

- `appMode`: 'budget' | 'items' - Toggle between the two main modes
- `itemsSubMode`: 'all' | 'reminders' | 'events' | 'notes' - Filter within items mode
- `createMode`: Controls which form to show (expense/reminder/event/note)

### React Query Hooks

Located in `src/features/items/useItems.ts`:

**Query Hooks:**

- `useItems(filters?, sort?)` - Fetch items with optional filtering
- `useReminders()` - Fetch only reminders
- `useEvents()` - Fetch only events
- `useNotes()` - Fetch only notes
- `useItem(id)` - Fetch single item with all details
- `useItemCategories()` - Fetch item categories

**Mutation Hooks:**

- `useCreateReminder()` - Create a new reminder
- `useCreateEvent()` - Create a new event
- `useCreateNote()` - Create a new note
- `useUpdateItem()` - Update item base fields
- `useUpdateReminderDetails()` - Update reminder-specific fields
- `useUpdateEventDetails()` - Update event-specific fields
- `useDeleteItem()` - Delete an item
- `useArchiveItem()` - Soft-delete (archive) an item
- `useCompleteReminder()` - Mark a reminder as completed
- `useToggleSubtask()` - Toggle subtask completion
- `useCreateItemCategory()` - Create a new category

### UI Components

**Navigation:**

- `AppModeToggle` (`src/components/navigation/AppModeToggle.tsx`) - Toggle between Budget and Items modes
- `ItemsSubModeSelector` - Filter selector for items (all/reminders/events/notes)
- `SemiDonutFAB` (`src/components/navigation/SemiDonutFAB.tsx`) - Floating action button that expands into a semi-donut menu for creating expense/reminder/event/note

**Forms:**

- `MobileItemForm` (`src/components/items/MobileItemForm.tsx`) - Unified form for creating reminders, events, and notes with step-by-step wizard

**Dashboard:**

- `ItemsDashboard` (`src/components/items/ItemsDashboard.tsx`) - Dashboard view for items, grouped by today/upcoming/completed

## User Flow

1. **Dashboard Toggle**: User can toggle between "Budget" and "Items" modes using the pill toggle in the dashboard header

2. **Creating Items**:
   - Tap the center FAB (+ button) in the bottom navigation
   - A semi-donut menu appears with 4 options: Expense, Reminder, Event, Note
   - Select an option to open the corresponding form

3. **Expense Flow** (unchanged):
   - Selecting "Expense" navigates to the expense tab
   - Standard expense form with amount, account, category, etc.

4. **Reminder/Event/Note Flow**:
   - Selecting Reminder/Event/Note opens `MobileItemForm`
   - Step-by-step wizard: Title → Date/Time → Details → Priority → Confirm
   - Form adapts based on item type (reminders have due date, events have start/end, etc.)

5. **Items Dashboard**:
   - When in "Items" mode, shows `ItemsDashboard`
   - Items grouped by: Today, No due date, Upcoming, Completed
   - Sub-mode filter to show All/Reminders/Events/Notes
   - Click checkbox to complete reminders
   - Hover to reveal delete button

## Theme Support

All new components are theme-aware, supporting both Blue and Pink themes:

- Blue theme: Cyan/blue accent colors, dark blue backgrounds
- Pink theme: Pink/amber accent colors, dark pink backgrounds

Theme colors are pulled from `useThemeClasses()` hook and applied conditionally.

## Files Created/Modified

### New Files:

- `migrations/add_items_system.sql` - Database migration
- `src/types/items.ts` - TypeScript types
- `src/contexts/AppModeContext.tsx` - App mode state management
- `src/features/items/useItems.ts` - React Query hooks
- `src/components/navigation/AppModeToggle.tsx` - Mode toggle component
- `src/components/navigation/SemiDonutFAB.tsx` - Floating action button menu
- `src/components/items/MobileItemForm.tsx` - Item creation form
- `src/components/items/ItemsDashboard.tsx` - Items dashboard view
- `src/components/items/index.ts` - Barrel export

### Modified Files:

- `src/app/providers.tsx` - Added AppModeProvider
- `src/app/layout.tsx` - Added MobileItemForm
- `src/components/layouts/MobileNav.tsx` - Replaced FAB with SemiDonutFAB
- `src/app/dashboard/DashboardClientPage.tsx` - Added mode toggle and conditional rendering

## Next Steps

1. **Run Migration**: Execute `migrations/add_items_system.sql` in Supabase
2. **Test Forms**: Test creating reminders, events, and notes
3. **Add Edit Functionality**: Implement edit flows for items
4. **Add Notifications**: Implement push notification system for alerts
5. **Google Calendar Sync**: Optional - sync events with Google Calendar
6. **Drag-and-Drop Reorder**: Allow reordering items and subtasks
