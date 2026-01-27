# Catalogue Tasks to Calendar Feature

This feature allows users to create task templates in the Catalogue → Tasks module and convert them to recurring calendar items.

## Overview

The Catalogue acts as a **"UI Database"** where users store their recurring task templates. These templates contain:

- Task details (title, description, priority)
- Location context (home/outside/anywhere)
- Preferred time and duration
- Recurrence pattern (daily, weekly, monthly, etc.)
- Subtasks as bullet points
- Tags for organization

When users click **"Add to Calendar"**, the template is converted to an actual calendar item with proper recurrence rules.

## Database Schema

### New Columns on `catalogue_items`

| Column                       | Type      | Description                                                                        |
| ---------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `item_type`                  | text      | Type when added to calendar: `reminder`, `event`, `task`                           |
| `location_context`           | text      | Where task is performed: `home`, `outside`, `anywhere`                             |
| `location_url`               | text      | Optional Google Maps or location URL                                               |
| `preferred_time`             | time      | Preferred time of day (HH:MM)                                                      |
| `preferred_duration_minutes` | integer   | Expected duration in minutes                                                       |
| `recurrence_pattern`         | text      | Pattern: `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, `custom` |
| `recurrence_custom_rrule`    | text      | Custom iCal RRULE for complex patterns                                             |
| `recurrence_days_of_week`    | integer[] | Days for weekly recurrence (0=Sunday, 6=Saturday)                                  |
| `subtasks_text`              | text      | Bullet-point subtasks as text                                                      |
| `is_active_on_calendar`      | boolean   | Whether item is currently scheduled                                                |
| `linked_item_id`             | uuid      | Reference to the active calendar item                                              |

### New Table: `catalogue_item_calendar_history`

Tracks the history of calendar additions/removals for auditing and undo functionality.

## Components

### CatalogueTaskItemDialog

A specialized modal for creating/editing task templates in the Tasks module.

**Fields:**

1. **Type** - Task, Reminder, or Event
2. **Title** - The task name
3. **Location Context** - At Home, Outside Home, or Anywhere
4. **Location URL** - Optional maps link (shown for "Outside" context)
5. **Preferred Time** - When the task should be scheduled
6. **Duration** - Expected time to complete (minutes)
7. **Recurrence Pattern** - How often it repeats
8. **Days of Week** - Specific days for weekly recurrence
9. **Subtasks** - Bullet-point list that becomes subtasks in calendar
10. **Description** - Additional notes
11. **Priority** - Low, Normal, High, Urgent, Critical
12. **Tags** - For categorization

### AddToCalendarDialog

Modal that appears when user clicks "Add to Calendar" on a task template.

**Features:**

- Shows task preview
- Allows setting/confirming start date and time
- Displays recurrence pattern with option to modify
- Optional end date toggle (defaults to "repeat forever")
- Shows subtasks preview that will be created
- Parses bullet-point text into actual subtasks

## User Flow

1. **Create Task Template**
   - Navigate to Catalogue → Tasks
   - Click "Add Item" → Opens CatalogueTaskItemDialog
   - Fill in task details, recurrence, subtasks
   - Save → Template stored in catalogue

2. **Add to Calendar**
   - In Tasks view, hover over item → Menu → "Add to Calendar"
   - Or click item → Detail dialog → "Add to Calendar" button
   - AddToCalendarDialog opens with pre-filled values
   - Confirm or adjust start date/time
   - Set end date if needed
   - Click "Add to Calendar"

3. **Calendar Item Created**
   - Creates item in `items` table with:
     - Proper recurrence rule (RRULE format)
     - Subtasks from bullet-point text
     - Alert at scheduled time
   - Updates catalogue item:
     - `is_active_on_calendar = true`
     - `linked_item_id = <created item id>`

4. **Visual Feedback**
   - Task card shows "Active" badge with calendar icon
   - Detail dialog shows "Active on Calendar" status
   - "Add to Calendar" button hidden for active items

## Example Use Cases

### Weekly Chores with Subtasks

```
Title: Kitchen Cleaning
Location: At Home
Time: 10:00 AM
Recurrence: Weekly (Saturday)
Subtasks:
- Wipe counters
- Clean stove
- Mop floor
- Empty trash
```

### Biweekly Family Visit

```
Title: Visit Parents
Location: Outside (maps link to their address)
Time: 2:00 PM
Duration: 180 minutes
Recurrence: Every 2 Weeks (Sunday)
```

### Daily Habit

```
Title: Water Plants
Location: At Home
Time: 7:00 AM
Duration: 10 minutes
Recurrence: Daily
```

## Technical Notes

### RRULE Generation

The system converts recurrence patterns to iCal RRULE format:

| Pattern                | RRULE                        |
| ---------------------- | ---------------------------- |
| daily                  | `FREQ=DAILY`                 |
| weekly (Mon, Wed, Fri) | `FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| biweekly               | `FREQ=WEEKLY;INTERVAL=2`     |
| monthly                | `FREQ=MONTHLY`               |
| quarterly              | `FREQ=MONTHLY;INTERVAL=3`    |
| yearly                 | `FREQ=YEARLY`                |

### Subtask Parsing

Bullet-point text is parsed line-by-line:

- Removes leading `-`, `*`, `•`, or numbered prefixes
- Creates `CreateSubtaskInput` with title and order_index
- Subtasks are created when the calendar item is added

### Migration

Run the migration to add new columns:

```sql
-- Run: migrations/add_catalogue_tasks_calendar_link.sql
```

## Future Enhancements

1. **Pause/Resume** - Temporarily pause calendar recurrence without removing
2. **Occurrence Tracking** - Track completed/skipped occurrences per subtask
3. **Smart Scheduling** - AI suggests optimal time slots based on history
4. **Sync Status** - Real-time sync status with external calendars
5. **Batch Operations** - Add multiple templates to calendar at once
