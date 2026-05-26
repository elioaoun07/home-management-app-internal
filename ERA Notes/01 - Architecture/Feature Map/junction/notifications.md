# Notifications

**Type:** Junction
**Vault doc:** `ERA Notes/03 - Junction Modules/Notifications/`

## What it does

Push + in-app notifications. Sources: item alerts, recurring payment reminders, budget spend thresholds. Delivered via web push (`push_subscriptions`); cron routes scan for due alerts and post.

## Files at a glance

- **Components**:
  - `src/components/notifications/NotificationCenter.tsx`
  - `src/components/notifications/NotificationBell.tsx`
  - `src/components/notifications/NotificationModal.tsx`
  - `src/components/settings/NotificationSettings.tsx`
- **API routes**:
  - `src/app/api/notifications/` (read, mark-read, subscribe)
  - `src/app/api/cron/` (per-source cron runners)
- **Service worker registration**:
  - `src/components/ServiceWorkerRegistration.tsx`
  - `src/components/ServiceWorkerWarmup.tsx`
  - `public/sw.js` (or similar in repo root `public/`)
- **DB tables**: `notifications`, `push_subscriptions`, `notification_preferences`
- **Deep-link routing**: `src/components/DeepLinkHandler.tsx` + `TabContext` (`pendingItemId`, `pendingThreadId`)

## Common edit scenarios

- **"Change notification copy"** → the cron runner that posts the notification (e.g. `src/app/api/cron/<runner>/route.ts`).
- **"Add a new notification source"** →
  1. New cron route. Verify `Bearer CRON_SECRET`, use `supabaseAdmin()`, set `maxDuration = 60` (Hard Rule #8/15).
  2. Insert into `notifications`.
  3. Push via the subscribe endpoint.
  4. Add toggle in `NotificationSettings.tsx` + `notification_preferences`.
- **"Edit the bell / center UI"** → `NotificationBell.tsx`, `NotificationCenter.tsx`.

## Gotchas

- Cron routes are the typical place where Hard Rule #6 (long `timeoutMs`) and #8/#15 (Bearer auth + `supabaseAdmin` + `maxDuration`) all apply at once.
- Tapping a push notification deep-links via `DeepLinkHandler` → `TabContext` pendingIds — don't bypass this; it preserves tab state.

## Connected modules

- **Items & Reminders** — item alerts.
- **Recurring Payments** — payment reminders.
- **Budget Allocation** — spend threshold alerts.
- **Chores** — chore reminders.
