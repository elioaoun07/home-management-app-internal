---
created: 2026-06-19
updated: 2026-06-20
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/notifications
---

# Notifications & Alerts · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface — every pending item, **phased**, with IDs, severity, effort, and source links. The narrative *why + order* is [3 · Action Plan](<3 - Action Plan.md>). **Point at a line (e.g. _1.2_), a group, or a phase.**
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. ✅ items stay as the record (Hard Rule #25 — no orphan fixes).
>
> **Status: nothing built yet** (docs created 2026-06-19).

---

### Phase 1 — Routing fix 🔴 _(W1 / M1 — the one blocker)_

- [ ] **1.1** Decide Option A (new `daily_items_summary` type) vs Option B (honor `action_url` for `source:"system"`). _(S)_
- [ ] **1.2** Update the cron: change `daily-items-reminder` to the new type (Option A) or fix `action_url` from `/items` → `/reminders` (Option B). → `src/app/api/cron/daily-items-reminder/route.ts` _(S)_
- [ ] **1.3** Update in-app routing: add the case to `getActionRoute()` (`→ /reminders`) or make it consult `action_url` first for system notifications. → `src/hooks/useNotifications.ts` _(S)_
- [ ] **1.4** Update push routing: add the case to the `notificationclick` switch in `public/sw.js` (and confirm `DeepLinkHandler` handles a `/reminders` hard-nav — it's a standalone route, not a tab). → `public/sw.js`, `src/components/DeepLinkHandler.tsx` _(S)_
- [ ] **1.5** If Option A: add the enum value to the TS `NotificationType` union + any Zod schema; confirm `migrations/schema.sql` reflects it (DB change → migration file first, Hard Rule #24). _(S)_
- [ ] **1.6** Verify end-to-end: tapping the summary (push + in-app) lands on `/reminders`; the budget reminder still opens the expense form. _(S)_

### Phase 2 — Calm bell 🟠 _(W2 / M2)_

- [ ] **2.1** Replace the `1s infinite` ring with a **finite** on-arrival animation (play once on new, then rest); drop the always-on `.animate-notification-pulse` while merely unread. → `src/components/notifications/NotificationBell.tsx`, `src/app/globals.css` _(M)_
- [ ] **2.2** Recolor the badge toward a calmer accent (theme/severity-aware); reserve red for urgent severities. Keep the count legible (`99+`). _(S)_
- [ ] **2.3** Add a `prefers-reduced-motion` path → static dot/count, no animation. _(S)_
- [ ] **2.4** Keep an explicit, accessible "N unread" + a calm "all caught up" rest state. _(S)_
- [ ] **2.5** Verify on a mobile viewport under each theme (Hard Rule #5). _(S)_

### Phase 3 — Concise drawer 🟠 _(W3 / M3)_

- [ ] **3.1** Collapse rows to one tier: **icon + title + short context + relative time**; remove/relocate the 2-line message (full text lives on the alerts page). → `src/components/notifications/NotificationModal.tsx` _(M)_
- [ ] **3.2** Convert quick actions to **icon-only/compact** controls with `aria-label`/tooltip; one primary inline, secondary in an overflow. → `getQuickActions()` in `src/hooks/useNotifications.ts` + render in `NotificationModal.tsx` _(M)_
- [ ] **3.3** Preserve **Undo** on destructive actions (Hard Rule #1) and use the `ToastIcons` enum. _(S)_
- [ ] **3.4** Floating-panel correctness: ensure the drawer/popover stays opaque per Hard Rule #15 (`tc.bgPage`, not glass) if any sub-panel floats. _(S)_
- [ ] **3.5** Verify on a mobile viewport. _(S)_

### Phase 4 — Scannable alerts page 🟠 _(W4 / M4)_

- [ ] **4.1** Card hierarchy: bold title → one-line context → time + a clear type icon; tighten copy throughout. → alerts render path in `src/components/hub/HubPage.tsx` (~5554–5737) _(M)_
- [ ] **4.2** Severity via **restrained accents** — confirm individual rows don't use red (Hard Rule #3); only container headers may. _(S)_
- [ ] **4.3** Keep the action-first transaction-reminder card but tighten its text + button copy. _(M)_
- [ ] **4.4** Verify on a mobile viewport; confirm `/alerts` top padding clears the fixed header (Hard Rule #16). _(S)_

### Phase 5 — Backlog (Should → Could) 🟡

- [x] **5.1** Group notifications by `group_key`/type in drawer + page (collapse "N reminders", expand on tap). _(M · W5/S1)_ — ✅ 2026-07-10: done on the **alerts page** (`dedupeByGroupKey()` + `×N` badge, date-grouped sections). Drawer (`NotificationModal.tsx`) not touched — still ungrouped.
- [x] **5.2** Filter segments on the alerts page. _(S–M · W6/S2)_ — ✅ 2026-07-10, but with a **different taxonomy than originally scoped**: user defined System vs Scheduled (not Budget/Reminders/Household) — see [file 2](<2 - Vision & Roadmap.md>) decision update. Chips: All / System / Scheduled / Unread.
- [ ] **5.3** Empty / "all caught up" states for drawer + page. _(S · W7/S3)_ — page's empty state preserved as-is (not redesigned).
- [ ] **5.4** Strip `console.*` from the notification crons (Hard Rule #22). → `src/app/api/cron/daily-items-reminder/route.ts`, `src/app/api/cron/daily-reminder/route.ts`, `src/app/api/cron/item-reminders/route.ts` _(S · W8/S4)_ — **still open**; 2026-07-10 instead stripped `console.*` from `/api/notifications/in-app` and `/api/notifications/actions` (touched for other reasons).
- [x] **5.5** Unify drawer ↔ alerts-page icon vocabulary + severity treatment. _(M · W9/S5)_ — ✅ 2026-07-10: both now call `renderNotificationIcon()` from the new registry (`src/lib/notifications/registry.tsx`).
- [ ] **5.6** Audit Undo on dismiss/snooze across both surfaces (Hard Rule #1). _(S · W10/S6)_ — still open on the drawer/alerts page (silent optimistic mutations, no toast). The new Critical Alert Gate (below) does have Undo.
- [ ] **5.7** Quiet hours / DND + per-type mute in Preferences. _(M–H · W11/C-1)_
- [ ] **5.8** Bulk actions: snooze-all, clear-category. _(M · W12/C-2)_

### Phase 6 — New capabilities shipped 2026-07-10 (not in the original scope)

> User contract: notifications felt weak/missed; asked for a full-screen catch-all view, a Google Calendar backup (one-way, parallel to the existing system), a System-vs-Scheduled alert taxonomy, and a scalable per-type action contract.

- [x] **6.1** Notification Registry — `src/lib/notifications/registry.tsx`, single source of truth per `notification_type` (route/actions/icon/class/calendarSync/takeoverEligible/retention). Prerequisite for 5.1/5.2/5.5 above and for 6.2–6.3.
- [x] **6.2** Alerts page unified onto `/api/notifications/in-app` (same source as the bell) + `useNotificationsRealtime()` (Supabase realtime, replaces 60s-stale polling) + localStorage dismissal layer deleted.
- [x] **6.3** Bug fix: `/api/notifications/actions` was writing to non-existent columns — every quick-action button was silently failing. Fixed.
- [x] **6.4** Critical Alert Gate — full-screen takeover for unacted high/urgent takeover-eligible alerts, on app open/focus regain. `src/components/notifications/CriticalAlertGate.tsx`, mounted in `src/app/layout.tsx`.
- [x] **6.5** Google Calendar one-way backup sync (scheduled items only, never system alerts) — `src/lib/gcal/`, `/api/gcal/*`, `/api/cron/gcal-reconcile`. Code-complete; **NOT live-verified** — needs user-provided `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI` (see `docs/ENV.md`).
  - [x] **2026-07-10 scope bugfix (found during live verification):** the original scope pair `calendar.events` + `calendar.calendarlist` does NOT cover `calendars.insert` — the OAuth callback failed with "Request had insufficient authentication scopes" while creating the ERA calendar. Fixed in `src/lib/gcal/client.ts`: single granular scope `calendar.app.created` (create own secondary calendars + manage their events — the exact API surface used, and non-sensitive). Also hit on the way: the Google consent screen requires the user on the Test users list while in Testing mode (403 access_denied otherwise). `docs/GOOGLE-CALENDAR-SETUP.md` scope instructions corrected to match.
- [ ] **6.6** Live-verify Google Calendar sync end-to-end once credentials are set (connect → event appears → native alarm fires → reconcile heals drift).
  - [x] 2026-07-10 — connect leg verified live on localhost: OAuth consent → callback → connection row stored, ERA calendar created on the user's Google account, and a direct test-event insert+delete on it succeeded using the stored refresh token.
  - [x] 2026-07-10 — sync leg verified live: `/api/gcal/sync-item` (see 6.7) called from the authenticated browser session pushed a test reminder to the ERA calendar with correct title/time, wrote `google_event_id`/`google_synced_at`/`last_synced_at`, and the delete action removed the event and cleared the references.
  - [ ] Still open: native alarm fires on the phone; reconcile cron heals drift (cron needs an external scheduler — never assume it's live).
- [x] **6.7** ✅ 2026-07-10 — **Critical bug: sync never fired from the app.** Root cause: the items hooks (`src/features/items/useItems.ts`) write **directly to Supabase from the browser** when online — `/api/items/*` (where the sync calls were wired) only runs on offline-queue replay, so creating/editing items produced zero Google API calls. Fix: new `POST /api/gcal/sync-item` route + `src/features/items/gcalSync.ts` client triggers wired into all eligible online mutation paths (create/update/archive/complete/recurrence; hard delete awaits Google cleanup BEFORE the row delete to avoid orphaned events); also wired the server-side gaps `/api/items/[id]/actions` (postpone/cancel/skip) and `/api/recycle-bin/restore`. Second bug found while tracing: `sync.ts` bookkeeping writes (`last_synced_at`, `sync_error`, partner-owned items) ran on the caller's user-context client and **silently no-oped under RLS** (no UPDATE policy) — bookkeeping now runs on `supabaseAdmin()`, with the caller's client kept as the access gate. Full architecture note in the [Notifications module doc](<../../03 - Junction Modules/Notifications/Notifications.md>).

---

## ✅ Definition of done — by phase

- [ ] **Phase 1:** tapping the daily items summary (push **and** in-app) lands on `/reminders`; the budget reminder still opens the expense form; `/items` no longer referenced; [1 · Feature State](<1 - Feature State.md>) Cluster 2 marked resolved.
- [ ] **Phase 2:** the bell no longer animates perpetually (finite-on-arrival only), respects `prefers-reduced-motion`, and the unread signal is calm but unambiguous.
- [ ] **Phase 3:** drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.
- [ ] **Phase 4:** the alerts page reads as scannable cards with clear hierarchy; no red on individual rows; verified on mobile.
- [ ] **Phase 5:** Should items shipped; Could items triaged.

---

## ✅ Implemented fixes log

- [x] **2026-06-19 — Drawer open animation:** removed the `contentReady` / `onAnimationComplete` entrance gate from `NotificationModal.tsx`, so opening is one drawer slide and cached content renders immediately.
- [x] **2026-07-10 — Notification Registry + alerts page unification + critical-alert gate + Google Calendar sync:** see Phase 5 (5.1, 5.2, 5.5) and Phase 6 above. Full detail in [FABLED 2 index](<FABLED 2/_index.md>) delta section.
- [x] **2026-07-10 — Hub chat visibility delivery:** private threads never notify the partner; all public thread purposes do; shopping-item replies now carry receipt-backed unread state.
