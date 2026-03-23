---
created: 2026-03-23
type: feature-doc
module: notifications
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/notifications
---
# Notifications System

> **Module:** `src/components/notifications/` | **API:** `src/app/api/notifications/`, `src/app/api/cron/`
> **DB Tables:** `notifications`, `notification_preferences`, `push_subscriptions`, `item_alerts`
> **Status:** Active

## Overview

Unified notification system combining push notifications (Web Push API) and in-app bell notifications. All notifications are stored in a single `notifications` table. Two cron jobs drive server-initiated notifications.

## Architecture

### Unified `notifications` table

Replaces the old `hub_alerts`, `notification_logs`, and `in_app_notifications` tables (all merged here).

Key columns:
- `notification_type`: `daily_reminder` | `item_due` | `item_reminder` | `budget_alert` | `system`
- `push_status`: `pending` | `sent` | `failed` | `skipped`
- `group_key`: deduplication key (e.g., `daily_reminder_2026-03-15`, `item_{id}_{alert_id}`)
- `action_type`: `confirm` | `complete_task` | `log_transaction` | `view_details` | `snooze` | `dismiss`
- `snoozed_until`, `snooze_count`: snooze support
- `expires_at`: auto-expiry for time-sensitive notifications

### Cron jobs

| Endpoint | Schedule | Purpose |
|---|---|---|
| `POST /api/cron/daily-reminder` | Every 5 min | "Did you log your transactions?" reminders |
| `POST /api/cron/item-reminders` | Every 1 min | Due items/tasks/events push alerts |

Both require `Authorization: Bearer CRON_SECRET` header.

**Vercel cron config (`vercel.json`):**
```json
{
  "crons": [
    { "path": "/api/cron/daily-reminder", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/item-reminders", "schedule": "* * * * *" }
  ]
}
```

### User-facing API routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/notifications/in-app` | GET, POST, PATCH, DELETE | CRUD for notifications |
| `/api/notifications/preferences` | GET, PUT | User settings |
| `/api/notifications/subscribe` | POST | Register push subscription |
| `/api/notifications/unsubscribe` | POST | Remove push subscription |
| `/api/notifications/actions` | POST, PATCH | confirm, dismiss, snooze, read |
| `/api/notifications/test` | POST | Test push notification |

## Push Notifications

### Setup

1. Generate VAPID keys: `node scripts/generate-vapid-keys.js`
2. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=
   VAPID_PRIVATE_KEY=
   VAPID_SUBJECT=mailto:your@email.com
   ```
3. Service worker handles push events at `public/sw.js`
4. Push subscriptions stored in `push_subscriptions` table

### Platform support

- **Android**: Chrome PWA (installed to home screen)
- **iOS**: Safari 16.4+, must be added to home screen

### Push behavior

- `requireInteraction: true` — stays on screen until user acts
- Long vibration pattern on Android
- Actions: "Snooze 5min" and "Dismiss"
- Priority indicator prefix: 🚨 Urgent, ❗ High, 🔔 Normal, 📝 Low

### Testing in dev

Set `NEXT_PUBLIC_ENABLE_SW=true` in `.env.local`, then `pnpm build && pnpm start` (service workers need production build).

## In-App Bell Notifications

**Component:** `src/components/notifications/NotificationCenter.tsx`

- Bell icon with badge counter in header
- Pulse animation when unread notifications exist
- Slide-out sheet from right side
- Actions: mark read, dismiss, snooze, complete task

**Hooks:** `src/hooks/useNotifications.ts`
- `useInAppNotifications({ limit })` — fetch with unread count
- `useMarkNotificationRead()` — mutation
- `useDismissNotification()` — mutation
- `useUnreadNotificationCount()` — count only

## Best Practices

1. **Always use `group_key`** to prevent duplicates
   - Daily: `daily_reminder_YYYY-MM-DD`
   - Item alerts: `item_{item_id}_{alert_id}`
2. Set `expires_at` for time-sensitive notifications
3. Always update `push_status`, `push_sent_at`, `push_error` after send attempt
4. Mark push subscriptions inactive on 404/410 errors (device unregistered)
5. Respect `quiet_hours_start` / `quiet_hours_end` from `notification_preferences`

## Gotchas

- Old routes (`/api/notifications/daily-reminder`, `/api/notifications/send-due`) redirect to new cron routes for backwards compatibility — do not rely on the old paths
- `in_app_notifications` table is deprecated — it was merged into `notifications` table
- Item alerts use the `item_alerts` table (with `trigger_at`, `channel`, `active`) — the cron queries this table to find due alerts
