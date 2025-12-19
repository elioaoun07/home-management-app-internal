# Notification System Architecture

## Overview

This document describes the consolidated notification system architecture after the refactoring effort. The system now uses a single unified `notifications` table and follows a clean separation between cron jobs (server-initiated) and user-facing API routes.

## Database Schema

### Core Tables

```sql
-- Unified notifications table (replaces hub_alerts, notification_logs, in_app_notifications)
notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  notification_type TEXT NOT NULL,  -- 'daily_reminder', 'item_due', 'item_reminder', 'system', 'budget_alert'
  title TEXT NOT NULL,
  message TEXT,
  icon TEXT,
  severity TEXT DEFAULT 'info',     -- 'info', 'warning', 'error', 'success'
  source TEXT DEFAULT 'system',     -- 'system', 'item', 'transaction', 'budget'
  priority TEXT DEFAULT 'normal',   -- 'low', 'normal', 'high', 'urgent'

  -- Action data
  action_type TEXT,                 -- 'confirm', 'add_expense', 'complete_task', 'view'
  action_url TEXT,
  action_data JSONB,
  action_taken BOOLEAN DEFAULT FALSE,
  action_taken_at TIMESTAMPTZ,

  -- Status tracking
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  snooze_count INT DEFAULT 0,

  -- Push notification status
  push_status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'skipped'
  push_sent_at TIMESTAMPTZ,
  push_error TEXT,

  -- Deduplication & expiration
  group_key TEXT,                   -- Prevents duplicate notifications
  expires_at TIMESTAMPTZ,

  -- Relations
  item_id UUID REFERENCES items,
  transaction_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- User notification preferences
notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  enabled BOOLEAN DEFAULT TRUE,
  preferred_time TIME DEFAULT '21:00',
  frequency TEXT DEFAULT 'daily',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Push subscription endpoints
push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Item alerts (for scheduled reminders/events)
item_alerts (
  id UUID PRIMARY KEY,
  item_id UUID REFERENCES items,
  trigger_at TIMESTAMPTZ NOT NULL,
  channel TEXT DEFAULT 'push',
  active BOOLEAN DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ
)
```

## API Routes Structure

### Cron Endpoints (Server-initiated)

These are called by external cron services and should NOT be called by client code.

| Endpoint                   | Schedule    | Purpose                                         |
| -------------------------- | ----------- | ----------------------------------------------- |
| `/api/cron/daily-reminder` | Every 5 min | Send "Did you log your transactions?" reminders |
| `/api/cron/item-reminders` | Every 1 min | Send push for due items/tasks/events            |

### User-Facing Endpoints

| Endpoint                         | Methods                  | Purpose                                                      |
| -------------------------------- | ------------------------ | ------------------------------------------------------------ |
| `/api/notifications/in-app`      | GET, POST, PATCH, DELETE | CRUD for notifications                                       |
| `/api/notifications/preferences` | GET, PUT                 | User notification settings                                   |
| `/api/notifications/subscribe`   | POST                     | Register push subscription                                   |
| `/api/notifications/unsubscribe` | POST                     | Remove push subscription                                     |
| `/api/notifications/actions`     | POST, PATCH              | Handle notification actions (confirm, dismiss, snooze, read) |
| `/api/notifications/snooze`      | POST                     | Snooze a notification                                        |
| `/api/notifications/test`        | POST                     | Test push notification                                       |

### Deprecated Endpoints (Redirect for backwards compatibility)

| Endpoint                                        | Redirects To                     | Notes                                     |
| ----------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `/api/notifications/daily-reminder`             | `/api/cron/daily-reminder`       | Old daily reminder route                  |
| `/api/notifications/send-transaction-reminders` | `/api/cron/daily-reminder`       | Old preferred_time route                  |
| `/api/notifications/send-due`                   | `/api/cron/item-reminders`       | Old item alerts route                     |
| `/api/notifications/sync`                       | N/A                              | No-op, sync not needed with unified table |
| `/api/notifications/dismiss`                    | Use `/api/notifications/actions` | Legacy support only                       |
| `/api/notifications/transaction-reminder`       | Use `/api/notifications/actions` | Legacy support only                       |

## Cron Configuration

### Vercel Cron (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-reminder",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/item-reminders",
      "schedule": "* * * * *"
    }
  ]
}
```

### External Cron Service

Call endpoints with `Authorization: Bearer YOUR_CRON_SECRET` header.

## Flow Diagrams

### Daily Transaction Reminder Flow

```
1. Cron calls /api/cron/daily-reminder every 5 minutes
2. Route checks all users with notifications enabled
3. Filters users whose preferred_time is within the current 5-min window
4. For each eligible user:
   a. Check if reminder already sent today (group_key dedup)
   b. Create notification in unified table
   c. Get user's push subscriptions
   d. Send web-push notification
   e. Update push_status and push_sent_at
```

### Item Reminder Flow

```
1. Cron calls /api/cron/item-reminders every minute
2. Route finds item_alerts with trigger_at due in last hour
3. Filters alerts that haven't been fired (last_fired_at IS NULL)
4. For each due alert:
   a. Create notification in unified table
   b. Send push notification
   c. Mark alert as fired (set last_fired_at)
```

### User Notification Action Flow

```
1. User clicks on notification action (confirm, dismiss, snooze)
2. Client calls /api/notifications/actions with action type
3. Route updates the unified notifications table:
   - dismiss: set dismissed_at, action_taken
   - confirm: set action_taken, action_taken_at
   - snooze: set snoozed_until, increment snooze_count
   - read: set read_at
```

## Notification Types

| Type             | Source | Description                          |
| ---------------- | ------ | ------------------------------------ |
| `daily_reminder` | system | Daily "log your transactions" prompt |
| `item_due`       | item   | Calendar event that's due            |
| `item_reminder`  | item   | Task or reminder that's due          |
| `budget_alert`   | budget | Budget threshold warning             |
| `system`         | system | General system notification          |

## Best Practices

1. **Deduplication**: Always use `group_key` to prevent duplicate notifications
   - Daily reminders: `daily_reminder_YYYY-MM-DD`
   - Item alerts: `item_{item_id}_{alert_id}`

2. **Expiration**: Set `expires_at` for time-sensitive notifications

3. **Push Status Tracking**: Always update `push_status`, `push_sent_at`, and `push_error`

4. **Inactive Subscriptions**: Mark push subscriptions as inactive (404/410 errors)

5. **Quiet Hours**: Respect user's quiet_hours_start and quiet_hours_end

## Migration Notes

The following tables were deprecated and replaced by `notifications`:

- `hub_alerts` - Merged into notifications
- `notification_logs` - Merged into notifications
- `in_app_notifications` - Merged into notifications

Old API routes now redirect to new endpoints for backwards compatibility.
