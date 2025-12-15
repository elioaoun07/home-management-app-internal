# Birthday Feature

## Overview

A static birthdays system that displays birthdays on your calendar and allows you to convert them into full events with specific details.

## How It Works

### 1. Static Birthdays File

Located at `src/data/birthdays.ts`, this file contains all your birthdays in a simple TypeScript array:

```typescript
export const BIRTHDAYS: Birthday[] = [
  {
    id: "bd-1",
    name: "Mom's Birthday",
    month: 3,
    day: 15,
    category: "family",
    year: 1970,
  },
  // Add more birthdays here...
];
```

### 2. Birthday Properties

- **id**: Unique identifier (e.g., "bd-1", "bd-2")
- **name**: Display name (e.g., "Mom's Birthday", "John's Birthday")
- **month**: Month number (1-12, where 1 = January, 12 = December)
- **day**: Day of month (1-31)
- **category**: One of: "family", "friends", "work", "community"
- **year** (optional): Birth year for age calculation

### 3. Calendar Display

Birthdays appear in **light grey** on both calendar views:

#### Month View

- Birthdays show with a cake icon 🎂
- Displayed at the top of each day's items
- Light grey color distinguishes them from regular events

#### Week View

- Birthdays appear as all-day items at the top of each day
- Same cake icon and light grey styling
- Non-intrusive design that doesn't interfere with timed events

### 4. Converting to Events

**Click any birthday** to open the event creation form with pre-filled data:

- **Title**: Pre-filled with the birthday person's name
- **Category**: Pre-filled with their birthday category (family/friends/work/community)
- **Date**: Set to the birthday date you clicked
- **Time, Location, Notes**: Empty for you to add specific celebration details

This allows you to:

- Add a specific time if you're attending a birthday party
- Set a location for the celebration
- Add notes like "Bring gift" or "Dinner at 7 PM"
- Set alerts/reminders
- Make it recurring or one-time

## Adding Birthdays

Open `src/data/birthdays.ts` and add entries to the `BIRTHDAYS` array:

```typescript
{
  id: "bd-3",
  name: "Sister's Birthday",
  month: 11,
  day: 8,
  category: "family",
  year: 1998,
},
```

## Features

### Automatic Recurrence

Birthdays automatically appear every year on the same date - no need to create recurring events!

### Age Calculation (Future Enhancement)

The `year` field enables age calculation. Helper function already exists:

```typescript
calculateAge(birthday, currentYear); // Returns age or null
```

### Categories

Birthdays are categorized just like events:

- **family**: Pink/warm colors
- **friends**: Cyan/blue colors
- **work**: Purple colors
- **community**: Green colors

## Workflow Example

1. **Add birthday to file**: Add "John's Birthday" on June 15
2. **View on calendar**: See "John's Birthday" appear in light grey on June 15
3. **Get invited to party**: Click the birthday on June 12 (when the party is)
4. **Form opens pre-filled**: Title = "John's Birthday", Category = "friends"
5. **Add details**: Set time "6:00 PM", location "The Restaurant", note "Bring gift"
6. **Save**: Now you have a full event for John's birthday party on June 12

The static birthday remains visible on June 15 every year, while the specific party event is saved separately.

## Design Philosophy

- **Static birthdays**: Simple, hardcoded list that appears every year
- **Events for celebrations**: Create actual events when you need specific times/locations
- **No duplication**: Birthday stays in the list, celebration becomes an event
- **Visual distinction**: Light grey color makes birthdays non-intrusive
- **One-click conversion**: Easy to convert birthday to event when needed

## Technical Details

### Files Modified

- `src/data/birthdays.ts` - Birthday data and helpers
- `src/components/web/WebCalendar.tsx` - Month view birthday display
- `src/components/web/WebWeekView.tsx` - Week view birthday display
- `src/components/web/WebEvents.tsx` - Birthday click handler
- `src/components/web/WebEventFormDialog.tsx` - Pre-fill support

### Birthday Display Logic

1. `getBirthdaysForDate(date)` filters birthdays by month/day
2. Calendar renders birthdays with grey styling before regular items
3. Click handler opens form with `prefillTitle` and `prefillCategory`
4. Form initializes with birthday data but creates a new event (not editing)

## Future Enhancements (Optional)

- Display age badge if birth year is provided
- Birthday countdown ("3 days until Mom's birthday")
- Automatic gift reminder creation
- Birthday import from contacts
- Recurring yearly event generation option
