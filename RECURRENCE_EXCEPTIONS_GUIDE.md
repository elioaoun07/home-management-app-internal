# Recurrence Exceptions & Overrides Guide

## Overview

This guide explains how to handle exceptions to recurring events, including:

- **One-time changes** (different time/location for a specific occurrence)
- **Skipped dates** (pausing recurrence for vacation/holidays)

## Database Schema

### Tables Involved

1. **`items`** - The main event/reminder
2. **`item_recurrence_rules`** - Defines the recurrence pattern (RRULE)
3. **`item_recurrence_exceptions`** - Stores exceptions/overrides

```sql
CREATE TABLE item_recurrence_exceptions (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES item_recurrence_rules(id),
  exdate TIMESTAMPTZ NOT NULL,  -- The date being excepted
  override_payload_json JSONB,  -- Optional: override data for this occurrence
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Use Cases & Implementation

### Use Case 1: Skip a Single Occurrence (Christmas Vacation)

**Scenario:** Biweekly meeting normally happens on Dec 25, but you want to skip it for Christmas.

**Solution:**

1. Add an exception with just the `exdate`, no `override_payload_json`
2. Calendar filters out this date when generating occurrences

**Database:**

```json
{
  "rule_id": "37030f9f-fd8f-4b5b-a44b-44d3fe30e1ca",
  "exdate": "2025-12-25T20:30:00Z",
  "override_payload_json": null
}
```

**Calendar Logic:**

```typescript
// When generating occurrences, exclude exception dates
const exceptions = await getExceptionsForRule(ruleId);
const occurrences = rrule
  .between(startDate, endDate, true)
  .filter(
    (date) => !exceptions.some((ex) => isSameDay(parseISO(ex.exdate), date))
  );
```

---

### Use Case 2: Override a Single Occurrence (Different Time/Location)

**Scenario:** Biweekly meeting at Location A, 4:00 PM. Tomorrow it's at Location B, 3:30 PM.

**Solution:**

1. Add an exception with `exdate` AND `override_payload_json`
2. Override payload contains the changed fields
3. Calendar shows modified version for that date

**Database:**

```json
{
  "rule_id": "37030f9f-fd8f-4b5b-a44b-44d3fe30e1ca",
  "exdate": "2025-12-18T16:00:00Z",
  "override_payload_json": {
    "start_at": "2025-12-18T15:30:00Z",
    "location_text": "Location B",
    "modified_fields": ["start_at", "location_text"]
  }
}
```

**Calendar Logic:**

```typescript
// When showing an occurrence, check if it has an override
const override = exceptions.find((ex) =>
  isSameDay(parseISO(ex.exdate), occurrence)
);
if (override?.override_payload_json) {
  return {
    ...baseEvent,
    ...override.override_payload_json,
    isException: true,
  };
}
```

---

### Use Case 3: Skip Multiple Dates (Vacation Period)

**Scenario:** Skip all meetings from Dec 20 - Jan 5 for holiday break.

**Solution:**

1. Add multiple exceptions, one per occurrence in the range
2. OR: Add a temporary `end_until` to the recurrence rule

**Option A - Multiple Exceptions:**

```sql
INSERT INTO item_recurrence_exceptions (rule_id, exdate)
VALUES
  ('rule-id', '2025-12-25T20:30:00Z'),
  ('rule-id', '2026-01-08T20:30:00Z');
```

**Option B - Temporary End Date:**

```sql
-- Modify the recurrence rule temporarily
UPDATE item_recurrence_rules
SET end_until = '2025-12-19T23:59:59Z'
WHERE id = 'rule-id';

-- Then create a NEW rule starting after vacation
-- This preserves history better
```

---

## UI/UX Design Patterns

### Pattern 1: "This Occurrence" vs "All Future" Dialog

When user clicks a recurring event:

```
┌─────────────────────────────────────┐
│ Edit Recurring Event                │
├─────────────────────────────────────┤
│ This event repeats every 2 weeks.   │
│                                     │
│ [ ] This occurrence only            │
│ [ ] This and all future occurrences │
│ [ ] All occurrences                 │
│                                     │
│        [Cancel]  [Continue]         │
└─────────────────────────────────────┘
```

**Logic:**

- **This occurrence only** → Create exception with override
- **This and all future** → Update `end_until` to day before, create new recurrence rule
- **All occurrences** → Update the main item

### Pattern 2: Exception Indicator

Show visual indicator on calendar for exceptions:

```tsx
{
  isException && (
    <span className="text-xs text-orange-400" title="Modified from series">
      ⚠️ Modified
    </span>
  );
}
```

### Pattern 3: Skipped Dates Management

Add a section in the event details:

```
Skipped Dates:
  • Dec 25, 2025 (Christmas) [Remove]
  • Jan 1, 2026 (New Year)  [Remove]

[+ Skip a date]
```

---

## Implementation Checklist

### Phase 1: Database Functions

```typescript
// Add to useItems.ts

export function useCreateRecurrenceException() {
  return useMutation({
    mutationFn: async (input: {
      rule_id: string;
      exdate: string;
      override?: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from("item_recurrence_exceptions")
        .insert({
          rule_id: input.rule_id,
          exdate: input.exdate,
          override_payload_json: input.override || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteRecurrenceException() {
  return useMutation({
    mutationFn: async (exceptionId: string) => {
      const { error } = await supabase
        .from("item_recurrence_exceptions")
        .delete()
        .eq("id", exceptionId);

      if (error) throw error;
    },
  });
}
```

### Phase 2: Update Calendar to Handle Exceptions

Update `WebCalendar.tsx` getItemsForDate:

```typescript
const getItemsForDate = (date: Date): ItemWithDetails[] => {
  return items.flatMap((item) => {
    // ... existing logic ...

    if (item.recurrence_rule) {
      const exceptions = item.recurrence_exceptions || [];
      const occurrences = rrule.between(startAnchor, maxDate, true);

      // Filter out skipped dates
      const validOccurrences = occurrences.filter(
        (occ) =>
          !exceptions.some(
            (ex) =>
              !ex.override_payload_json && isSameDay(parseISO(ex.exdate), occ)
          )
      );

      // Check if this date is a valid occurrence
      const matchingOccurrence = validOccurrences.find((occ) =>
        isSameDay(occ, date)
      );

      if (matchingOccurrence) {
        // Check for override
        const override = exceptions.find(
          (ex) =>
            ex.override_payload_json &&
            isSameDay(parseISO(ex.exdate), matchingOccurrence)
        );

        if (override) {
          return [
            {
              ...item,
              ...override.override_payload_json,
              isException: true,
            },
          ];
        }
        return [item];
      }
    }

    return [];
  });
};
```

### Phase 3: Update Item Types

Add exceptions to `ItemWithDetails`:

```typescript
export interface ItemWithDetails extends Item {
  // ... existing fields ...
  recurrence_rule?: RecurrenceRule | null;
  recurrence_exceptions?: RecurrenceException[];
}
```

### Phase 4: Add UI Components

Create `RecurrenceExceptionDialog.tsx`:

- Skip date picker
- Override fields (time, location, etc.)
- List of existing exceptions

### Phase 5: Update Query to Load Exceptions

```typescript
// In fetchItems and fetchItemById
const { data, error } = await supabase.from("items").select(`
    *,
    reminder_details (*),
    event_details (*),
    item_recurrence_rules (*),
    item_recurrence_exceptions (*)  // ADD THIS
  `);
```

---

## Best Practices

1. **Always Show Context**: When editing a recurring event, show "This is a recurring event" message
2. **Preserve History**: Don't delete; use exceptions to maintain audit trail
3. **Clear Indicators**: Show visual cues for modified/skipped occurrences
4. **Undo Support**: Allow users to remove exceptions easily
5. **Performance**: Limit occurrence generation to visible date range (1 year max)

## Testing Scenarios

1. Create biweekly event
2. Skip one occurrence (Christmas)
3. Override one occurrence (different time/location)
4. Edit "all future" → should create new rule
5. Delete original series → exceptions should cascade delete
6. View calendar → should see gaps and overrides correctly

---

## Alternative: Google Calendar Approach

Google Calendar creates a **separate event** for overridden occurrences with a reference to the parent:

```sql
-- Override creates a new item with parent reference
INSERT INTO items (...)
VALUES (..., parent_recurring_item_id = 'original-id', is_exception = true);
```

**Pros:**

- Simpler querying (just join on parent_id)
- Full flexibility (any field can change)

**Cons:**

- More database rows
- Harder to "unapply" exception

Choose based on your needs!
