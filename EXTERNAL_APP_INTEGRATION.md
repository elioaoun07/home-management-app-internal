# External App Integration for Hub Conversations

This document describes the architecture for linking Hub conversations to external PWA applications.

## Overview

The Hub chat system now supports linking conversations to external PWA applications like:

- **Budget App**: `https://home-management-app-internal.vercel.app/expense`
- **Reminder App**: `https://home-manager-pwa.vercel.app/`

Each conversation can have a `purpose` that determines:

1. Which external app to link to
2. Which message actions are suggested (transaction vs reminder)
3. Visual styling and badges

## Database Schema

### New Columns in `hub_chat_threads`

```sql
-- Purpose of the conversation
purpose TEXT DEFAULT 'general'
  CHECK (purpose IN ('general', 'budget', 'reminder', 'shopping', 'travel', 'health', 'other'))

-- External app URL for deep linking
external_url TEXT

-- Display name for the external app
external_app_name TEXT
```

### Migration

Run the migration file: `migrations/add_thread_purpose.sql`

This will:

1. Add the new columns
2. Create an index on `purpose`
3. Update any existing "Budget" or "Reminder" threads with the correct URLs

## Purpose Configuration

| Purpose  | Icon | External URL | App Name     | Default Action |
| -------- | ---- | ------------ | ------------ | -------------- |
| general  | 💬   | null         | null         | none           |
| budget   | 💰   | Budget App   | Budget App   | transaction    |
| reminder | ⏰   | Reminder App | Reminder App | reminder       |
| shopping | 🛒   | null         | null         | none           |
| travel   | ✈️   | null         | null         | none           |
| health   | 🏥   | null         | null         | none           |
| other    | 📋   | null         | null         | none           |

## UI Components

### Thread List (`ThreadItem`)

- Shows external app indicator badge on thread icon
- Quick-launch button to open external app
- Purpose badge showing the conversation type

### Thread Conversation Header

- External app button in header for quick navigation
- Purpose badge next to title
- External link indicator on thread icon

### Create Thread Modal

- Purpose selector with visual grid
- Auto-selects matching icon when purpose changes
- Shows external app info when purpose has linked app

## Cross-App Authentication

### Current Behavior

Both apps use Supabase Auth with the same project. When a user:

1. Is logged in on the Budget App (this app)
2. Navigates to the Reminder App via external link
3. The Reminder App checks for Supabase session

**Important**: Each PWA has its own session storage. Users need to:

1. Be logged in on BOTH apps independently
2. Sessions persist as long as tokens are valid (typically 1 hour, refresh tokens last longer)

### Seamless Navigation

- External links use `window.location.href` for same-tab navigation
- PWA installed on mobile will open in same app context
- If session is valid, user lands directly on target page (e.g., `/expense`)
- If session expired, user will see login page on target app

### Best Practices

1. **Stay logged in**: Keep both PWAs installed and logged in
2. **Default pages**: Budget link goes to `/expense`, Reminder link goes to `/`
3. **Session persistence**: Tokens auto-refresh in background when apps are used

## Cross-App Item Creation

### Overview

The Hub can create items directly in external apps without navigating away. This is implemented for:

- **Reminder App**: Create reminders/events/notes from chat messages

### Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  HubPage.tsx    │────▶│ AddReminderModal.tsx │────▶│ /api/hub/create-    │
│  (Long press)   │     │ (Form UI)            │     │ reminder/route.ts   │
└─────────────────┘     └──────────────────────┘     └──────────┬──────────┘
                                                                │
                                                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  cross_app_user_mappings                                                │
│  Budget User ID ──────▶ Reminder App User ID                            │
└─────────────────────────────────────────────────────────────────────────┘
                                                                │
                                                                ▼
                                                     ┌─────────────────────┐
                                                     │ Reminder App DB     │
                                                     │ - items             │
                                                     │ - reminder_details  │
                                                     │ - event_details     │
                                                     └─────────────────────┘
```

### Setup Instructions

#### 1. Environment Variables

Add these to your `.env.local`:

```bash
# Reminder App Supabase credentials (for cross-app item creation)
REMINDER_APP_SUPABASE_URL=https://your-reminder-app.supabase.co
REMINDER_APP_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Important**: Use the **service role key** (not anon key) from your Reminder App's Supabase dashboard.

#### 2. Run Database Migrations

```bash
# Add thread purpose columns
psql -f migrations/add_thread_purpose.sql

# Add cross-app user mappings table
psql -f migrations/add_cross_app_user_mappings.sql
```

#### 3. Configure User Mappings

The migration includes initial mappings. To add more users:

```sql
INSERT INTO cross_app_user_mappings (
  source_app,
  source_user_id,
  target_app,
  target_user_id
) VALUES (
  'budget-app',
  'budget-app-user-uuid',
  'reminder-app',
  'reminder-app-user-uuid'
);
```

### User ID Mappings

Current mappings configured:

| User | Budget App ID                          | Reminder App ID                        |
| ---- | -------------------------------------- | -------------------------------------- |
| Elio | `1cb9c50a-2a41-4fb3-8e90-2e270ca28830` | `222c44a5-6b17-4df4-9735-f8ddf5178f46` |
| Wife | `c23cd730-b468-4b2f-8db0-8c8100f79f4b` | `5e124102-190b-46e3-a4f5-e7d7c9409fda` |

### How It Works

1. User long-presses a message in a "reminder" purpose thread
2. Action menu shows "Add as Reminder" (⏰)
3. Clicking opens `AddReminderFromMessageModal`
4. User fills in reminder details (title, due date, priority, etc.)
5. Form submits to `/api/hub/create-reminder`
6. API:
   - Gets current Budget App user
   - Looks up mapped Reminder App user ID
   - Creates `item` in Reminder App database
   - Creates `reminder_details` or `event_details` based on type
7. Success creates a message action, marking message as converted
8. Message shows "Added as reminder" badge

### Reminder App Schema (Reference)

```sql
-- Items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  type TEXT NOT NULL, -- 'reminder', 'event', 'note', 'shopping', 'task'
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminder details (for type='reminder')
CREATE TABLE reminder_details (
  item_id UUID PRIMARY KEY REFERENCES items(id),
  due_at TIMESTAMPTZ,
  remind_at TIMESTAMPTZ,
  recurrence TEXT,
  estimate_minutes INTEGER
);

-- Event details (for type='event')
CREATE TABLE event_details (
  item_id UUID PRIMARY KEY REFERENCES items(id),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  location TEXT,
  all_day BOOLEAN DEFAULT FALSE
);
```

## Future Improvements

1. **More App Integrations**: Add support for:
   - Shopping list app
   - Travel planner
   - Health tracker

2. **Bidirectional Sync**: Allow external apps to create Hub messages

3. **Deep Linking**: Pass context data to external app:

   ```
   https://home-management-app-internal.vercel.app/expense?from=hub&thread=xxx&action=add
   ```

4. **Shared Session**: Implement cross-domain session sharing

## Code References

- **Types**: `src/features/hub/hooks.ts` - `HubChatThread`, `ThreadPurpose`
- **API**: `src/app/api/hub/threads/route.ts` - Thread CRUD
- **API**: `src/app/api/hub/create-reminder/route.ts` - Cross-app reminder creation
- **UI**: `src/components/hub/HubPage.tsx` - ThreadItem, ThreadConversation, CreateThreadModal
- **UI**: `src/components/hub/AddReminderFromMessageModal.tsx` - Reminder creation modal
- **DB Client**: `src/lib/supabase/reminder-app.ts` - Reminder App Supabase client
- **Migration**: `migrations/add_thread_purpose.sql`
- **Migration**: `migrations/add_cross_app_user_mappings.sql`
