---
created: 2026-06-19
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED 2, FABLED 3 (originals in ../_Archive/Notifications & Alerts/)"
tags:
  - pm/master-book
  - scope/module
  - module/notifications
---

# Notifications & Alerts — Master Book

> **Campaign:** Notifications & Alerts · prefix `NOTIF` · working queue → [4 · Checklist](<4 - Checklist.md>)

## Identity & North Star

"Notifications & Alerts" is the user-facing surface of the **Notifications** Junction module (Items alerts, Recurring reminders, Budget spending alerts). The data layer is the unified `notifications` table, which replaced the old `hub_alerts` + `in_app_notifications`.

Notifications have one job: **say the right thing, calmly, and take me to the right place when I act.** The system is technically complete (unified table, push + in-app, dedup keys, a type registry) but the *experience* leans the wrong way — it shouts (bell), mis-routes (items summary), and over-explains (drawer + alerts page).

**Vision in one line:** *a calm, glanceable notification layer — a quiet "you have something" signal, a fast drawer to triage, and a scannable alerts page to dig in — where every tap lands on the tool that resolves it.*

**The guiding split (one job per surface):** the **bell** is ambient presence (calm, not alarming) · the **drawer** is the fast lane (glanceable rows, one-tap actions, triage) · the **alerts page** is the detailed lane (descriptive but skimmable, grouped, filterable).

**Source:** `src/lib/notifications/registry.tsx` (the type system — single source of truth per type), `src/components/notifications/`, `src/hooks/useNotifications.ts`, `src/app/alerts/`, `src/app/api/notifications/`, `src/app/api/cron/{daily-reminder,daily-items-reminder,item-reminders,chat-notifications,gcal-reconcile,purge-recycle-bin}/`, `public/sw.js`. Vault: [Notifications / Overview](<../../03 - Junction Modules/Notifications/Overview.md>).

## Current State (verified)

**Maturity 5.8 / 10 as of 2026-07-18 (FABLED 3) — an affirmation generation over an 8-day-old verified base.**

| Dimension | Score | Evidence |
|---|---|---|
| Data model | 8 | the registry + gcal tables |
| Delivery correctness | 8 | actions-route column bug fixed; private-thread exclusion enforced on both push paths |
| UX calm | 4 | bell wobble / red badge untouched — Phase 2 still open |
| Intelligence | 4 | `group_key` grouping + critical-alert gate; no delivery-policy engine yet |
| Hygiene | 5 | three cron routes still carry `console.*` (2026-07-18: `daily-items-reminder` 13, `item-reminders` 9, `daily-reminder` 8) |
| Handoff readiness | 6 | the registry makes notification types mechanical to extend (any-model); cron/push delivery paths are mid-tier; the unscheduled-cron ambiguity is the one live danger |

| Surface | Tier | Reality |
|---|---|---|
| Notification bell + badge | 🔵 | header button with `AlertBellIcon`; **perpetual** `.animate-notification-ring` (1 s infinite) + red count badge + pulse ring while unread; "clear all" plays a 2 s celebration; count from `useUnreadNotificationCount()` (polls 30 s) |
| Notification side drawer | 🔵 | right-side sheet; each row = icon circle + title + 2-line message + relative time + 1–3 **labelled** quick actions + dismiss + unread dot; "Mark all read" + "View All Alerts" footer |
| View All Alerts page | 🔵 | `/alerts` renders the `HubPage` alerts path; unified onto the bell's data source, realtime, date-grouped and `group_key`-deduped with filter chips and a shared icon vocabulary |
| Daily budget reminder | 🔵 | `daily-reminder` cron at the user's preferred times; click opens the mobile expense form. **Works as intended — the reference behaviour** |
| Daily items summary | 🟠 | `daily-items-reminder` cron: morning "You have N items today" / evening "N overdue items". **Mis-typed as `daily_reminder` with `action_url: "/items"` (a dead route)** → click wrongly opens the expense form |
| Per-item reminders | 🔵 | `item-reminders` cron → `item_reminder` / `item_due`; push `data.url = /expense?tab=reminder&item=ID` deep-links correctly via `setPendingItemId` — the reference routing pattern |
| Click routing / deep-links | 🔵 | push: `sw.js` `notificationclick` → `openApp()` → `postMessage("NAVIGATE")` → `DeepLinkHandler`. In-app: `getActionRoute()`. **Type-based routing wins over `action_url`** |
| Data model | 🔵 | unified `notifications` table: `notification_type`, `action_type`, `action_url`, `action_data`, `group_key`, `source`, `priority`, `severity`, `snoozed_until`, `expires_at` + item/transaction/recurring FKs |
| Critical-alert takeover | 🟡 | `CriticalAlertGate.tsx` — full-screen takeover for `takeoverEligible` types at high/urgent priority, session-scoped "Later" |
| Google Calendar backup | 🟡 | one-way App → Google for Scheduled notifications only; **code-complete, never live-tested** (needs credentials) |

## Pain Inventory

- 🔴 **The daily items summary opens the expense form.** It shares the `daily_reminder` type with the budget reminder, so both `getActionRoute()` and the `sw.js` switch send it to `/expense`; its `action_url: "/items"` is ignored *and* points at a route that does not exist (the real list is `/reminders`). Tapping "You have N items today" drops you on the budget entry screen.
- 🟠 **The bell rings perpetually while unread** — a 1 s infinite wobble plus an always-on pulse ring reads as an alarm and pulls the eye every second. It also ignores `prefers-reduced-motion`.
- 🟠 **Drawer rows are over-described** — title + 2-line message + timestamp + worded action pills. A glance should yield "what + when"; instead every row is a paragraph.
- 🟠 **Three cron routes still carry `console.*`** (Hard Rule 22) — 13 / 9 / 8 as of 2026-07-18.
- 🟠 **Nothing in the repo schedules the crons.** `vercel.json` is absent; an external scheduler must be configured. Code that "shipped" may never run — this includes `gcal-reconcile`, shared with the Schedule campaign.
- 🟡 `daily_reminder` is overloaded — two different notifications can't be routed, themed or filtered apart.
- 🟡 **Registry vs `sw.js` duality** — `sw.js` lives outside the registry, so push can show different text/actions than in-app. Change both sides or neither.
- 🟡 The drawer is still ungrouped even though `group_key` grouping shipped on the alerts page; five item reminders are five rows.
- 🟡 Dismiss/snooze on the drawer and alerts page are silent optimistic mutations with no toast — Hard Rule 1 requires Undo. (The Critical Alert Gate does have it.)
- 🟡 No quiet hours / DND / per-type mute; volume grew (critical gate + gcal) while a send budget still doesn't exist.
- ⚪ Expiry/retention is set inconsistently across types.
- ⚪ No calm "you're caught up" state — the only strong signal is the alarm.

## Shipped Log

- ✅ 2026-07-10 — **notification type registry** (`src/lib/notifications/registry.tsx`): one entry per type drives route, actions, icon, class, `calendarSync`, `takeoverEligible` and retention
- ✅ 2026-07-10 — **alerts page unified** onto the bell's data source: realtime, date-grouped, `group_key`-deduped, filter chips, shared icon vocabulary
- ✅ 2026-07-10 — actions-route column bug fixed (quick actions had silently no-opped for weeks)
- ✅ 2026-07-10 — **critical-alert takeover gate** (`CriticalAlertGate.tsx`) for `item_due` / `item_overdue` / `bill_overdue` / `budget_exceeded` at high/urgent priority, with Undo and a session-scoped "Later"
- ✅ 2026-07-10 — **Google Calendar backup sync** (one-way, Calendar API not ICS) for Scheduled notifications, with three same-day fix passes — including catching its own "code-complete" claim being false when sync never fired from online mutations
- ✅ 2026-07-10 — private-thread exclusion enforced on the immediate Hub push path as well as the cron, closing an owner-only visibility leak; the Budget/Reminder purpose allowlist removed from both paths
- ✅ 2026-07-10 — `console.*` stripped from `/api/notifications/in-app` and `/api/notifications/actions`

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Locked decisions (don't re-litigate)

1. **The bell is ambient, not an alarm** — finite on-arrival animation, `prefers-reduced-motion` support, calmer colour; the unread *count* stays, the perpetual motion goes.
2. **The daily items summary opens `/reminders`; the budget reminder still opens `/expense`.** Prefer a dedicated `daily_items_summary` type (cleanest — it also unblocks per-type theming/filtering) over making the routers honour `action_url` for `source: "system"`. Either way the dead `/items` URL is corrected.
3. **The drawer is the fast lane** — one-line rows, icon/compact actions with accessible labels, grouping, Undo preserved. Full prose moves to the alerts page.
4. **The alerts page is the detailed-but-skimmable lane** — card hierarchy, grouping, filter segments, one design language shared with the drawer. *(IMPLEMENTED 2026-07-10.)* The filter taxonomy that shipped is **System / Scheduled / Unread**, not the originally-sketched Budget/Reminders/Household split — per-type filters proved confusing.
5. **Strip `console.*` from the notification crons** as part of any touch.
6. **Two-type taxonomy: System alerts vs Scheduled notifications.** *System* = app-generated prompts (log-transaction nudges, overdue summaries, budget/bill/goal alerts, chat, future proactive alerts) — **never** syncs to Google Calendar. *Scheduled* = fired from a user-created Reminder/Event (`item_reminder`/`item_due`/`item_overdue`) — the only class eligible for calendar sync. Encoded as `NotificationClass` in the registry, derived per-type, not a DB column.
7. **Google Calendar API, one-way, parallel to the existing system.** App → Google only; Google is never read back. The Calendar API was chosen over an ICS feed because Google only refreshes ICS subscriptions every 8–24 h, which fails the "accurate even if delayed or offline" goal that a live API push + native alarm gives. *(IMPLEMENTED 2026-07-10 — code-complete, not live-tested.)*
8. **Full-screen critical-alert takeover as a third "catch my attention" layer**, alongside push `requireInteraction` and Google's native alarms. Registry-defined eligibility only, session-scoped dismissal. *(IMPLEMENTED 2026-07-10.)*

### Best-practice brief (what the campaign is measured against)

1. **Calm by default** — animate on change, then rest; reserve red/amber for genuine urgency.
2. **Glanceability over completeness, in the right place** — one job per surface.
3. **Actionable, not just informative** — the next step inline, and reversible (Undo).
4. **Land on the resolving tool** — wrong-destination taps are the most damaging failure.
5. **Group to reduce volume** — volume is the enemy of attention.
6. **Respect the attention budget** — quiet hours, per-type mute, digests over singleton streams.
7. **Accessibility is not optional** — `prefers-reduced-motion`, labels on icon-only controls, colour never the only carrier of meaning.
8. **One visual language** across drawer and page.
9. **Scannable hierarchy** — bold title → one-line context → time.
10. **Clear empty states** — "all caught up" should feel like a reward.

### The next three moves

1. **Schedule the `gcal-reconcile` cron and prove it runs** (`last_synced_at` advancing daily) — shared with the Schedule campaign.
2. **Calm the bell** — finite ring, severity-aware badge, `prefers-reduced-motion`.
3. **Delivery-policy skeleton** — quiet hours + a daily push budget.

### Won't do (this campaign)

- ⚪ A standalone notification-centre route separate from `/alerts` — `/alerts` + drawer already cover it, and a third surface fights "one job per surface".
- ⚪ Cross-device read-state sync indicators — the `notifications` table is already shared.
- ⚪ ML/AI priority ranking — premature until grouping and types are clean.
- ⛔ Geofenced/location-fired alerts — no-geofencing is an app-level decision.

## Acceptance Criteria Index

### NOTIF-1.6
- **Acceptance:** tapping the daily items summary from **both** push and in-app lands on `/reminders`; the budget reminder still opens the expense form; `/items` is no longer referenced anywhere.

### NOTIF-2.1
- **Acceptance:** the bell animates once on arrival and then rests; no animation plays while merely unread; `prefers-reduced-motion` yields a static dot/count.

### NOTIF-3.1
- **Acceptance:** each drawer row renders one information tier (icon + title + short context + relative time) with icon/compact actions carrying `aria-label`s, and Undo survives on destructive actions.

### NOTIF-6.6
- **Acceptance:** with credentials set, connecting produces a Google event, the native alarm fires on the phone, and the reconcile cron heals an induced drift — with a recorded last-run trace proving the cron is actually scheduled.

## Successor Briefing

**Who should read this:** you are about to touch notifications, alerts, push or cron delivery. This is a **Junction**. The registry makes most work mechanical; the delivery paths and crons are where mistakes reach the user's pocket at 3am.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/app/api/notifications src/app/api/cron src/components/notifications src/lib/notifications
grep -n "takeoverEligible\|calendarSync" src/lib/notifications/registry.tsx | head   # the registry is the type system
```

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| New notification type | any-model | add a registry entry (route, actions, icon, class, calendarSync, takeoverEligible, retention) + the DB `notification_type` — the registry drives everything else |
| Alerts-page UI, filters, grouping | any-model | `ui-guardrails`; it reads `/api/notifications/in-app` — never add a second endpoint |
| Quick-action changes (Done/Snooze/Confirm/Dismiss) | mid-tier+ | the actions route was silently broken once (column mismatch); change it WITH a route test; every action toast needs Undo |
| Cron logic changes | mid-tier+ | cron template (Bearer `CRON_SECRET`, `supabaseAdmin()`, `maxDuration = 60`); answer "how do I know it ran" in the code comment |
| Push delivery paths / `sw.js` | mid-tier+ | `sw.js` is OUTSIDE the registry — change both sides or neither |
| Takeover-gate eligibility, delivery policy | human-first | full-screen interruptions and send budgets are household-experience decisions — propose, let Elio feel it |

**Out-of-depth tells — stop if:** you're adding notification behaviour anywhere but the registry; you're creating a second in-app read endpoint; you're editing a cron without knowing what schedules it (nothing in the repo does).

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| Crons don't self-schedule | code "shipped" but never runs | no `vercel.json`; verify liveness, never assume |
| Registry vs `sw.js` duality | push shows different text/actions than in-app | update both |
| Private-thread exclusion | "missing" hub notifications | by design (`chatNotificationPolicy`) — check visibility first |
| The actions-route scar | quick actions silently no-op | columns were once wrong for weeks; any actions change needs a verifying test |
| gcal code lives in Schedule paths | audit/edit confusion | Schedule owns the sync tech; this campaign owns delivery and liveness |
| Cron on `supabaseServer` | empty results / silent RLS filtering | crons use `supabaseAdmin()` (Hard Rule 8) |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| Registry is consulted | `grep -rln "notifications/registry" src \| wc -l` | >3 |
| Single in-app read source | `grep -rln "api/notifications/in-app" src \| wc -l` | small stable set (bell + alerts page + hook) |
| Six cron routes | `ls src/app/api/cron/` | daily-reminder, daily-items-reminder, item-reminders, chat-notifications, gcal-reconcile, purge-recycle-bin |
| Cron auth pattern | `grep -l "CRON_SECRET" src/app/api/cron/*/route.ts \| wc -l` | 6 |
| `console.*` debt | `grep -rc "console\." src/app/api/cron --include="*.ts"` | shrinking from 13/9/8 |

**Inherited lesson (from the densest audit entry in the vault):** *"code-complete" and "wired into the live mutation path" are different claims; only the second counts.*

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Vault: [Notifications / Overview](<../../03 - Junction Modules/Notifications/Overview.md>)
- Pre-consolidation originals (including the full 07-02 → 07-10 evidence-dense movement record in the frozen FABLED 2 index): `../_Archive/Notifications & Alerts/`
