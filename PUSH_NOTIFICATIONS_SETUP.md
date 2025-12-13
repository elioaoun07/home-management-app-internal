# Push Notifications Setup

This document explains how to set up and use push notifications for reminders in the app.

## Overview

The push notification system allows you to receive alarm-like notifications when your reminders are due, even when the app is closed. It works on:

- **Android**: Chrome PWA (installed to home screen)
- **iOS**: Safari PWA (iOS 16.4+ required, added to home screen)

## How It Works

1. **Service Worker** (`public/sw.js`) - Runs in the background and handles push events
2. **Push Subscriptions** - Stored in the `push_subscriptions` table per user/device
3. **Web Push API** - Sends encrypted notifications from the server to your device
4. **Scheduler** - A cron job calls `/api/notifications/send-due` every minute to check for due reminders

## Setup Instructions

### 1. Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for secure push messaging.

```bash
node scripts/generate-vapid-keys.js
```

This will output three environment variables. Add them to your `.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

### 2. Run Database Migration

Apply the migration to create the `push_subscriptions` and `notification_logs` tables:

```sql
-- In Supabase SQL Editor, run:
-- migrations/add_push_subscriptions.sql
```

### 3. Set Up Cron Job

You need a scheduler to call the notification endpoint every minute. Options:

#### Option A: Vercel Cron (if using Vercel)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/notifications/send-due",
      "schedule": "* * * * *"
    }
  ]
}
```

Add `CRON_SECRET` to your environment variables and Vercel will use it automatically.

#### Option B: External Cron Service

Use a service like:

- [cron-job.org](https://cron-job.org) (free)
- [Upstash](https://upstash.com) (free tier)
- [EasyCron](https://www.easycron.com)

Set up a job to POST to:

```
https://your-domain.com/api/notifications/send-due
```

With header:

```
Authorization: Bearer YOUR_CRON_SECRET
```

Add the same secret to your environment:

```env
CRON_SECRET=your_secret_here
```

### 4. Enable in App

1. Open the app Settings → Notifications
2. Click "Enable Notifications"
3. Accept the browser permission prompt
4. Test with "Send Test Notification"

## Environment Variables

| Variable                       | Description                       | Required    |
| ------------------------------ | --------------------------------- | ----------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key (safe to expose) | Yes         |
| `VAPID_PRIVATE_KEY`            | VAPID private key (keep secret)   | Yes         |
| `VAPID_SUBJECT`                | Contact email for VAPID           | Yes         |
| `CRON_SECRET`                  | Secret to authorize cron job      | Recommended |
| `NEXT_PUBLIC_ENABLE_SW`        | Set to "true" to enable SW in dev | Optional    |

## API Endpoints

| Endpoint                         | Method   | Description                     |
| -------------------------------- | -------- | ------------------------------- |
| `/api/notifications/subscribe`   | POST     | Save push subscription          |
| `/api/notifications/unsubscribe` | POST     | Remove push subscription        |
| `/api/notifications/test`        | POST     | Send test notification          |
| `/api/notifications/send-due`    | POST/GET | Check and send due reminders    |
| `/api/notifications/snooze`      | POST     | Snooze a reminder for 5 minutes |
| `/api/notifications/dismiss`     | POST     | Mark notification as dismissed  |

## Notification Behavior

### Alarm-like Features

- **requireInteraction**: Notification stays on screen until user interacts
- **Vibration Pattern**: Long vibration pattern on Android (500ms on, 200ms off, repeated)
- **Renotify**: Always makes sound even if updating existing notification
- **Actions**: "Snooze 5min" and "Dismiss" buttons

### Priority Indicators

- 🚨 Urgent
- ❗ High
- 🔔 Normal
- 📝 Low

## Troubleshooting

### Notifications not working on iOS

1. iOS requires Safari 16.4+ on iPhone or iPad
2. App must be "Added to Home Screen" (not just browser)
3. User must grant permission when prompted
4. Notifications only work when device is not in "Do Not Disturb"

### Notifications not working on Android

1. Ensure app is installed as PWA (Add to Home Screen)
2. Check notification permissions in device settings
3. Disable battery optimization for Chrome/the app

### Test notification works but reminders don't

1. Verify the cron job is running (check logs)
2. Ensure `CRON_SECRET` matches in your environment and cron job
3. Check that reminders have `item_alerts` with `trigger_at` set
4. Verify alerts have `channel = 'push'` and `active = true`

## Database Schema

```sql
-- Push subscriptions per device
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Notification logs for debugging
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  alert_id UUID,
  subscription_id UUID,
  title TEXT,
  body TEXT,
  status TEXT, -- pending, sent, failed, clicked, dismissed
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

## Development

To test notifications in development:

1. Set `NEXT_PUBLIC_ENABLE_SW=true` in `.env.local`
2. Run `pnpm build && pnpm start` (service workers need production build)
3. Or use ngrok to expose localhost and test on mobile

## Security Notes

- VAPID private key must never be exposed to clients
- Push subscriptions are encrypted end-to-end
- Users can only see/modify their own subscriptions (RLS enabled)
- Cron endpoint is protected by `CRON_SECRET`
