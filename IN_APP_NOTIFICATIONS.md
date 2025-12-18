# In-App Notifications System

A comprehensive notification system for the Budget Manager app that provides in-app notifications with actions, animated bell icon, and customizable preferences.

## Features

### 🔔 Notification Bell (Header)

- **Badge Counter**: Shows the number of unread notifications
- **Pulse Animation**: Bell rings and pulses when there are new notifications
- **Celebration Animation**: Sparkle animation with checkmark when all caught up
- **Accessible**: Proper ARIA labels for screen readers

### 📬 Notification Modal

- **Slide-out Sheet**: Opens from the right side
- **Notification List**: Shows recent notifications with icons and timestamps
- **Action Buttons**: Context-aware buttons based on notification type
- **Mark as Read**: Automatic and manual marking
- **Dismiss**: Swipe or click to dismiss notifications
- **View All**: Links to Hub > Alerts for full history

### ⚙️ Notification Preferences (Settings)

- **Daily Transaction Reminder**: Toggle on/off
- **Weekly Summary**: Toggle on/off
- **Budget Alerts**: Toggle on/off
- **Per-notification frequency customization** (future)

### 🔄 Cron Integration

- **Daily Reminder**: Automated daily reminder to log transactions
- **Sync from Push**: Notifications pushed via cron appear in-app when you open the app

## Database Schema

### Tables

#### `in_app_notifications`

Stores all in-app notifications for the bell icon.

| Column              | Type        | Description                                                       |
| ------------------- | ----------- | ----------------------------------------------------------------- |
| id                  | UUID        | Primary key                                                       |
| user_id             | UUID        | User reference                                                    |
| title               | TEXT        | Notification title                                                |
| message             | TEXT        | Optional message body                                             |
| icon                | TEXT        | Emoji or icon identifier                                          |
| source              | ENUM        | system/cron/alert/item/transaction/budget/household               |
| priority            | ENUM        | low/normal/high/urgent                                            |
| action_type         | ENUM        | confirm/complete_task/log_transaction/view_details/snooze/dismiss |
| action_data         | JSONB       | Custom data for the action                                        |
| action_completed_at | TIMESTAMPTZ | When the action was completed                                     |
| is_read             | BOOLEAN     | Whether the notification has been seen                            |
| is_dismissed        | BOOLEAN     | Whether the notification has been dismissed                       |
| group_key           | TEXT        | For deduplication (e.g., daily_transaction_reminder_2024-12-18)   |
| expires_at          | TIMESTAMPTZ | Optional expiration                                               |

#### `notification_preferences`

User preferences for notification customization.

| Column         | Type      | Description                      |
| -------------- | --------- | -------------------------------- |
| id             | UUID      | Primary key                      |
| user_id        | UUID      | User reference                   |
| preference_key | TEXT      | e.g., daily_transaction_reminder |
| enabled        | BOOLEAN   | Whether enabled                  |
| frequency      | TEXT      | daily/weekly/monthly/custom      |
| preferred_time | TIME      | Preferred notification time      |
| timezone       | TEXT      | User's timezone                  |
| days_of_week   | INTEGER[] | Active days (1=Mon, 7=Sun)       |

#### `notification_templates`

System templates for generating notifications.

| Column              | Type    | Description                             |
| ------------------- | ------- | --------------------------------------- |
| template_key        | TEXT    | Unique identifier                       |
| title               | TEXT    | Template title                          |
| message_template    | TEXT    | Template with placeholders              |
| default_action_type | ENUM    | Default action                          |
| is_system           | BOOLEAN | Whether it's a core system notification |

## API Endpoints

### `/api/notifications/in-app`

- **GET**: Fetch notifications for the current user
  - Query params: `limit`, `include_read`
  - Returns: `{ notifications, unread_count }`
- **POST**: Create a new notification (for testing)
- **PATCH**: Update notification (mark read, dismiss, complete action)
  - Body: `{ id, is_read, is_dismissed, action_completed }`
  - Supports bulk: `{ ids: [...], is_read: true }`
- **DELETE**: Delete a notification

### `/api/notifications/preferences`

- **GET**: Fetch user preferences and available templates
- **POST**: Create or update a preference
- **DELETE**: Delete a preference (reverts to default)

### `/api/notifications/daily-reminder`

- **GET/POST**: Cron endpoint to generate daily transaction reminders
- Protected by `CRON_SECRET`
- Creates personalized notifications based on user activity

### `/api/notifications/sync`

- **POST**: Sync notifications from cron/push to in-app
- Called automatically when fetching notifications
- Syncs from: `notification_logs`, `hub_alerts`

## Notification Action Types

| Action Type       | Description             | Button Text     | Behavior               |
| ----------------- | ----------------------- | --------------- | ---------------------- |
| `confirm`         | Simple acknowledgment   | "Got it"        | Dismisses notification |
| `complete_task`   | Mark task as done       | "Mark Complete" | Completes action       |
| `log_transaction` | Navigate to expense tab | "Log Now"       | Opens expense tab      |
| `view_details`    | Navigate to details     | "View"          | Opens relevant page    |
| `snooze`          | Snooze for later        | "Snooze"        | Snoozes notification   |
| `dismiss`         | Dismiss without action  | "Dismiss"       | Dismisses notification |

## Component Usage

### Adding NotificationCenter to a page

```tsx
import { NotificationCenter } from "@/components/notifications";

function Header() {
  return (
    <header>
      <NotificationCenter />
    </header>
  );
}
```

### Using the hooks

```tsx
import {
  useInAppNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useDismissNotification,
} from "@/hooks/useNotifications";

function MyComponent() {
  const { data } = useInAppNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();

  const handleClick = (id: string) => {
    markRead.mutate(id);
  };
}
```

## Cron Setup

### Vercel Cron

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/daily-reminder",
      "schedule": "0 20 * * *"
    }
  ]
}
```

### External Cron (cron-job.org, Upstash)

Call the endpoint with authorization:

```
GET /api/notifications/daily-reminder
Authorization: Bearer <CRON_SECRET>
```

## Animation Classes

The following CSS classes are available for notification animations:

- `.animate-notification-ring` - Bell ringing animation
- `.animate-notification-badge` - Badge pop-in animation
- `.animate-notification-pulse` - Pulsing ring effect
- `.animate-check-draw` - Checkmark draw animation
- `.animate-sparkle-1` through `.animate-sparkle-4` - Celebration sparkles

## Migration

Run the migration file:

```sql
psql -d your_database -f migrations/add_in_app_notifications.sql
```

Or apply through Supabase dashboard.

## Future Enhancements

- [ ] Time-based preferences (notification at specific times)
- [ ] Quiet hours configuration
- [ ] Push notification integration for in-app notifications
- [ ] Notification grouping/stacking
- [ ] Rich notification content (images, progress bars)
- [ ] Notification channels (email, SMS)
