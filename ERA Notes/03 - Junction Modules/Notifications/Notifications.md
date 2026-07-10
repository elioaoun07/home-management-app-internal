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

> **Module:** `src/components/notifications/` | **API:** `src/app/api/notifications/`, `src/app/api/cron/`, `src/app/api/gcal/`
> **DB Tables:** `notifications`, `notification_preferences`, `push_subscriptions`, `item_alerts`, `google_calendar_connections`
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

## Implementation Notes

- `NotificationModal.tsx` should open as one Framer Motion drawer transition. Do not gate cached drawer content behind `onAnimationComplete`; show skeleton rows only while the notification query is genuinely loading, otherwise the open reads as a two-step motion.

## Notification Registry *(added 2026-07-10)*

**File:** `src/lib/notifications/registry.tsx` — single source of truth per `notification_type`. Before this, routing lived in `getActionRoute()`, actions in `getQuickActions()`, and icons were hand-duplicated separately in `NotificationModal.tsx` and the alerts page — three places to update per type, guaranteed to drift. `Record<NotificationType, NotificationTypeSpec>` now forces every DB enum value to have a spec (route resolver, quick actions, icon, `class`, `calendarSync`, `takeoverEligible`, `defaultPriority`, `expiresAfterHours`) — a type with no entry cannot compile.

**Two-type taxonomy (user-defined 2026-07-10):**
- **System alerts** — app-generated prompts (daily reminders, budget/bill/goal nudges, chat, summaries). Never sync to Google Calendar.
- **Scheduled notifications** — fired from a user-created Reminder/Event (`item_reminder`/`item_due`/`item_overdue`). Eligible for the Google Calendar backup sync.

`useNotifications.ts` re-exports `getActionRoute`, `getQuickActions`, `getNotificationClass`, `renderNotificationIcon`, `isCalendarSyncEligible`, `isTakeoverEligible` from the registry so existing call sites don't churn. **Adding a new notification type = one enum migration + one registry entry — nothing else.**

Known remaining duplication (not closed this pass): `public/sw.js`'s push-notification vibration/action tables are still hand-maintained separately (plain JS service worker file, no build step imports the TS registry). `NotificationModal.tsx` also keeps its own copy of the route-navigation tab-parsing logic (`navigateForNotification`/`handleNotificationClick`) rather than the new `useNotificationNavigation()` hook, to avoid touching its documented animation-timing constraints. Both are candidates for a future consolidation pass.

## Alerts Page — Unified Data Source *(2026-07-10)*

`/alerts` (`AlertsView` in `src/components/hub/HubPage.tsx`) previously read `/api/hub/alerts` (no type/actioned filtering, 60s `staleTime`, no realtime, localStorage-based dismissal) while the bell drawer read `/api/notifications/in-app` — two endpoints, two shapes, could disagree, and the alerts page never felt current. AlertsView now consumes the same `useInAppNotifications()` hook as the drawer, plus a shared `useNotificationsRealtime()` hook (Supabase `postgres_changes` subscription on `notifications`, RLS-scoped, no explicit `user_id` filter needed) mounted in both `NotificationCenter` (bell, global) and `AlertsView` (standalone `/alerts` page, which hides the header). The localStorage dismissal layer (`getDismissedAlerts`/`addDismissedAlert`/`cleanupDismissedAlerts` in `useHubPersistence.ts`) was deleted — dismissal is server state only now.

AlertsView adds: filter chips (All / System / Scheduled / Unread, from the registry's `class`), Today/Yesterday/Earlier collapsible date sections with a global expand/collapse (`groupItemsByDate()` — generic, shared with `FeedView`), and `group_key` repeat-collapsing with a `×N` badge (`dedupeByGroupKey()`). Card actions render from `getQuickActions()` — the same registry-driven action set as the drawer.

`FeedView` (transactions-only feed) got the same date-grouping/collapse treatment, reusing `groupItemsByDate()`.

**Bug fixed in the same pass:** `/api/notifications/actions` (POST/PATCH — powers every quick-action button: Done/Snooze/Confirm/Dismiss) was writing to columns that don't exist on `notifications` (`dismissed_at`, `action_taken_at`, `read_at`, `snooze_count` — the real columns are `is_dismissed`, `action_completed_at`, `is_read`, no snooze counter). Every quick-action click was silently failing. Fixed to use the real column names.

## Critical Alert Gate *(added 2026-07-10)*

**Component:** `src/components/notifications/CriticalAlertGate.tsx`, mounted in `src/app/layout.tsx` behind `{user && ...}`. Full-screen opaque takeover (Hard Rule 15, `z-[9999]`) shown on app open/focus regain when unacted notifications exist with `registry[type].takeoverEligible === true` (currently `item_due`, `item_overdue`, `bill_overdue`, `budget_exceeded`) and `priority` is `high`/`urgent`. This is the third "catch my attention" layer alongside push (`requireInteraction: true`) and Google Calendar's native alarms — a guaranteed catch on every app open even if the push was missed/delayed/offline.

"Later" hides the gate for the current session only (component state, not persisted) — it reappears on next app open if still unacted. Every action shows an Undo toast (Hard Rule 1); Undo PATCHes `/api/notifications/in-app` with `{is_dismissed:false, is_read:false, action_completed:false, snoozed_until:null}`. This required widening that route's PATCH handler: `action_completed` was previously truthy-only (`if (action_completed) {...}`), so there was no way to *clear* `action_completed_at` — now `action_completed !== undefined` lets a client explicitly pass `false` to un-complete.

## Google Calendar One-Way Backup Sync *(added 2026-07-10)*

**Scope fence:** app → Google only, one-way, never reads Google back. System alerts never sync — only `class: "scheduled"` items (Reminders/Events with a due/start time). This supersedes an earlier "ICS-first" note elsewhere in the vault (see `Functional Architecture Review`) — the user explicitly chose the Calendar API over ICS because ICS subscriptions in Google Calendar only refresh every 8–24h, which defeats the "accurate backup timing even if cronjob.com is delayed" goal.

**Files:**
- `src/lib/gcal/client.ts` — OAuth2 client factory, consent URL, token exchange, per-user authenticated Calendar API client (mirrors `pushSender.ts`'s pattern of accepting a Supabase client from the caller rather than constructing its own).
- `src/lib/gcal/sync.ts` — `syncItemToGoogleCalendar(supabase, itemId)` (insert/patch, RRULE passthrough via the existing `buildFullRRuleString` — no new recurrence engine per recurrence-safety) and `deleteItemFromGoogleCalendar(supabase, itemId)`. Both are best-effort: every failure is caught internally and recorded on `google_calendar_connections.sync_error`, never thrown into the caller's mutation.
- `src/app/api/gcal/connect`, `/callback`, `/connection` (GET status / PATCH toggle / DELETE disconnect) — OAuth flow + settings surface (`GoogleCalendarSettings.tsx` in Settings → Notifications tab).
- `src/app/api/cron/gcal-reconcile` — daily, Bearer `CRON_SECRET`. Two passes per connected user: re-push every currently-eligible item (heals drift), then delete Google events for items that are no longer eligible but still have a stale `google_event_id`.

**DB:** new `google_calendar_connections` table (per-user `refresh_token`, dedicated `google_calendar_id` created on first connect, `sync_enabled`, `last_synced_at`, `sync_error`). Reuses the pre-existing (previously orphaned — no code referenced it) `items.google_event_id` column as the item↔event mapping instead of a new join table; added `items.google_synced_at` for reconcile bookkeeping. Migration: `migrations/2026-07-10_google-calendar-sync.sql`.

**Sync trigger points — GOTCHA (bug found + fixed 2026-07-10):** the items mutation hooks in `src/features/items/useItems.ts` write **directly to Supabase from the browser** when online — they only pass through `/api/items/*` on offline-queue replay. So wiring sync into those routes alone means it never fires in normal usage. The real trigger architecture is:

- **Client (online direct-write) path:** every eligible mutation hook in `useItems.ts` (create reminder/event/task, update item/reminder-details/event-details, archive, complete, recurrence-rule change) fires `triggerGcalSync(itemId)` from `src/features/items/gcalSync.ts` → `POST /api/gcal/sync-item` (fire-and-forget, 30 s `timeoutMs`). Hard delete instead **awaits** `removeFromGcalBeforeDelete(itemId)` *before* the row delete — once the row is gone, `google_event_id` is lost and the Google event orphans forever (reconcile can't see deleted rows either).
- **Server (offline-replay + server-mutation) path:** `POST /api/items` (create), `PATCH/DELETE /api/items/[id]`, `POST /api/items/[id]/complete`, `POST /api/items/[id]/actions` (postpone changes the due time; cancel/skip make the item ineligible), and `POST /api/recycle-bin/restore` (restored items become eligible again — sync lives in the route, NOT the registry's `onRestore`, because the registry is imported by client code and `sync.ts` imports `googleapis`). Server calls are `await`ed because Vercel functions can terminate after the response; errors never propagate since the sync functions swallow them internally.

**Client-inside-sync gotcha:** the caller's Supabase client is only the **access gate** (the initial item fetch). All bookkeeping inside `sync.ts` runs on `supabaseAdmin()` — `google_calendar_connections` has no user UPDATE policy (user-context writes to `last_synced_at`/`sync_error` silently no-op under RLS), and the connection row may belong to the *responsible* user (partner), which the caller's RLS can't read.

**Setup + verification state (2026-07-10):** requires a Google Cloud OAuth client and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` (see `docs/ENV.md` and `docs/GOOGLE-CALENDAR-SETUP.md`); without them the feature is a safe no-op (`/api/gcal/connect` → 503). The OAuth scope is the single granular `calendar.app.created` — `calendar.events` + `calendar.calendarlist` do NOT cover `calendars.insert` and fail with "insufficient authentication scopes". While the consent screen is in Testing status, Google expires refresh tokens after **7 days** — publish to Production (no verification needed for this non-sensitive scope) before relying on it. Live-verified on localhost: connect → ERA calendar created → event insert/patch/delete + DB bookkeeping all confirmed against the real Google account. Still unverified: native alarm firing on the phone, and the reconcile cron (needs the external scheduler).
