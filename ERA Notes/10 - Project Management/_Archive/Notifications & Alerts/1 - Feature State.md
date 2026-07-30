---
created: 2026-06-19
updated: 2026-06-19
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/notifications
---

# Notifications & Alerts · 1 — Feature State

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **This file = Feature State + the full Pain Inventory** (Part A + Part B below).
>
> **What this file is:** two halves of the same picture — **(A) the honest, no-hype state of every notification surface** (bell, drawer, alerts page, the two system notifications, the routing layer) and **(B) the full Pain Inventory** (every painful thing, written as `Pain → Why it hurts → Root cause → Evidence → Severity`). No solutions here (that's [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>)); no sequencing here (that's [3 · Action Plan](<3 - Action Plan.md>)). This is the terrain.
>
> **Method & confidence:** claims are traced to real files from a codebase read on **2026-06-19**. The routing bug in Cluster 2 was confirmed end-to-end (cron → service worker → in-app router). The maturity tiers are **structural** ("how battle-tested"), not a line-by-line correctness audit.
>
> **Module identity:** "Notifications & Alerts" is the user-facing surface of the **Notifications** Junction module. The data layer is the unified `notifications` table (it replaced the old `hub_alerts` + `in_app_notifications`). At the app level it is **🔵 Established** — shipping and stable, but with concentrated UX debt.

---

# Part A — Feature State (Current Reality)

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled. |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
|---|---|---|---|
| **Notification bell + badge** | 🔵 Established | Header button with futuristic `AlertBellIcon`; perpetual `.animate-notification-ring` (1s infinite wobble) + red count badge + `.animate-notification-pulse` ring when unread; "clear all" plays a 2s green celebration. Count from `useUnreadNotificationCount()` (polls 30s). | Calm the perpetual animation; add `prefers-reduced-motion`. → [file 2](<2 - Vision & Roadmap.md>) |
| **Notification side drawer** | 🔵 Established | Right-side sheet; each row = icon circle + title + 2-line message + relative time + 1–3 **labelled** quick-action buttons (`getQuickActions()`) + dismiss X + unread dot. "Mark all read" + "View All Alerts" footer. | Trim rows to a glanceable density; icon/compact actions. |
| **View All Alerts page** | 🔵 Established | `/alerts` → renders `HubPage` (alerts + feed tabs). Two row types: a large cyan transaction-reminder card (Yes-all-done / Log Expense / Snooze / Change Time) and compact severity-bordered alert rows. Word-dense. | Scannable card redesign with clear hierarchy + grouping. |
| **Daily budget reminder** | 🔵 Established | `daily-reminder` cron at user's preferred times; title "Did you log your transactions?"; `notification_type: "daily_reminder"`. Click → opens the mobile expense form. **Works as intended.** | Leave behavior; only rename type if Cluster 2 fix needs it. |
| **Daily items summary** | 🟠 Stub/Partial | `daily-items-reminder` cron: morning "You have N items today 📋" / evening "N overdue items ⚠️". **Mis-typed as `daily_reminder` and `action_url: "/items"` (a dead route).** Click → wrongly opens the expense form. | **🔴 routing fix** → route to `/reminders`. |
| **Per-item reminders** | 🔵 Established | `item-reminders` cron → `item_reminder` / `item_due`; push `data.url = /expense?tab=reminder&item=ID`. Click correctly deep-links to the item detail modal via `setPendingItemId`. | — (reference for the correct routing pattern) |
| **Click routing / deep-links** | 🔵 Established | Push: `sw.js` `notificationclick` → `openApp()` → `postMessage("NAVIGATE")` → `ServiceWorkerRegistration` → `DeepLinkHandler` (`setActiveTab` / `setPendingItemId`). In-app: `getActionRoute()` in `useNotifications.ts`. **Type-based routing wins over `action_url`.** | Make routing honor system `action_url`, or add a dedicated type. |
| **Notifications data model** | 🔵 Established | Unified `notifications` table: `notification_type`, `action_type`, `action_url`, `action_data`, `group_key` (dedup), `source`, `priority`, `severity`, `snoozed_until`, `expires_at`, plus `item_id`/`transaction_id`/`recurring_payment_id` FKs. | `group_key` exists but grouping is unused in the UI. |

---

## Related code (single source of truth)

Do **not** duplicate file-path tables here — they drift. The authoritative code map lives in [Notifications / Overview](<../../03 - Junction Modules/Notifications/Overview.md>). The anchor files this campaign touches:

- **Bell:** [NotificationBell.tsx](<../../../src/components/notifications/NotificationBell.tsx>) · animations in [globals.css](<../../../src/app/globals.css>) · mounted in [ConditionalHeader.tsx](<../../../src/components/layouts/ConditionalHeader.tsx>).
- **Drawer:** [NotificationModal.tsx](<../../../src/components/notifications/NotificationModal.tsx>) + [NotificationCenter.tsx](<../../../src/components/notifications/NotificationCenter.tsx>); quick-actions + `getActionRoute()` in [useNotifications.ts](<../../../src/hooks/useNotifications.ts>).
- **Alerts page:** [alerts/page.tsx](<../../../src/app/alerts/page.tsx>) → the alerts render path in [HubPage.tsx](<../../../src/components/hub/HubPage.tsx>) (~lines 5554–5737).
- **System notifications:** budget → [daily-reminder/route.ts](<../../../src/app/api/cron/daily-reminder/route.ts>); items summary → [daily-items-reminder/route.ts](<../../../src/app/api/cron/daily-items-reminder/route.ts>); per-item → [item-reminders/route.ts](<../../../src/app/api/cron/item-reminders/route.ts>).
- **Routing:** [public/sw.js](<../../../public/sw.js>) (`notificationclick`, `openApp`) · [ServiceWorkerRegistration.tsx](<../../../src/components/ServiceWorkerRegistration.tsx>) · [DeepLinkHandler.tsx](<../../../src/components/DeepLinkHandler.tsx>).
- **Reminders destination:** [reminders/page.tsx](<../../../src/app/reminders/page.tsx>) (the real list; **`src/app/items/page.tsx` does not exist**).
- **Schema:** [migrations/schema.sql](<../../../migrations/schema.sql>) — `notifications` table.

---

## The honest weak-link summary *(the foundational risks)*

1. **One system notification routes to the wrong screen.** The daily items summary shares the `daily_reminder` type with the budget reminder, so both the service worker and `getActionRoute()` send it to `/expense`. Its `action_url: "/items"` is both ignored *and* points at a non-existent route. This is the one true 🔴.
2. **The bell's "always-on" animation is a design liability, not just taste.** A perpetual ring + red badge trains the eye to treat the bell as an alarm; it also ignores `prefers-reduced-motion` (an accessibility gap).
3. **Density debt on two surfaces.** The drawer over-describes (2-line body + timestamp + worded buttons); the alerts page is a wall of prose. Both reduce glanceability — the core job of a notification.
4. **Latent taxonomy + hygiene debt.** `notification_type` is overloaded (items summary mislabelled), `group_key` grouping is unused, and the cron routes carry many `console.*` calls (Hard Rule #22).

---

# Part B — Pain Inventory (Every Painful Thing)

> Every painful thing about Notifications & Alerts, written down so the scope is *visible*. **No solutions here** (that's [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>)) and **no sequencing** (that's [3 · Action Plan](<3 - Action Plan.md>)).

## Severity scale

| Mark | Meaning |
|---|---|
| 🔴 **Blocker** | Stops a core flow or sends the user to the wrong place. Fix first. |
| 🟠 **Friction** | Works, but the daily cost is high enough to annoy or distract. |
| 🟡 **Annoyance** | Noticeable, livable, fix when convenient. |
| ⚪ **Cosmetic / parked** | Minor, or deliberately out of scope for this campaign. |

---

## Cluster 1 — Bell & badge friction *(the "annoying / distracting" feeling)*

> The bell is supposed to say "you have something" calmly. Today it *shouts*.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| **Bell rings perpetually while unread** | A never-stopping wobble in the header reads as an alarm and pulls the eye every second; it's fatiguing rather than informative. | `hasNotifications && "animate-notification-ring"` applies a **1s infinite** wobble; an `.animate-notification-pulse` ring is also always-on while unread. | [NotificationBell.tsx](<../../../src/components/notifications/NotificationBell.tsx>); keyframes in [globals.css](<../../../src/app/globals.css>) | 🟠 |
| **Red badge feels like an error state** | Red is the universal "something is wrong" color; using it for an ordinary unread count raises baseline anxiety. | `bg-red-500` count badge, always red regardless of severity. | `NotificationBell.tsx` badge span | 🟡 |
| **Animation ignores reduced-motion** | Users who set `prefers-reduced-motion` still get the perpetual wobble — an accessibility miss. | No `prefers-reduced-motion` guard on the ring/pulse keyframes. | [globals.css](<../../../src/app/globals.css>) animation defs | 🟡 |
| **No calm "you're caught up" state** | The only strong signal is the alarm; there's no equally clear *calm* state, so "no news" is just the absence of noise. | Bell has active (loud) and inactive (plain) states only. | `NotificationBell.tsx` | ⚪ |

---

## Cluster 2 — System-notification routing *(wrong screen on click)*

> The crux pain. The two system notifications should land on *their* tool. One does; one doesn't.

### 🧨 Confirmed: the daily items summary is mis-typed and mis-routed (2026-06-19)

> The `daily-items-reminder` cron creates its notification with **`notification_type: "daily_reminder"`** — the *same type* as the budget reminder — and **`action_url: "/items"`**. Two independent problems compound:
> 1. **`/items` is a dead route** — there is no `src/app/items/page.tsx`; the real list is [`/reminders`](<../../../src/app/reminders/page.tsx>).
> 2. **Type-based routing wins anyway.** `getActionRoute()` maps `daily_reminder → /expense`, and `sw.js` `notificationclick` hardcodes `daily_reminder → /expense`. So the `action_url` is never consulted; the summary always opens the **expense form**.
>
> Net effect: tapping "You have N items today" drops the user on the budget expense entry screen instead of their reminders.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| **Daily items summary opens the expense form** | The single highest-friction click: I tap a *reminders* notification and land on a *budget* screen — wrong mental model, wrong tool, dead end. | Summary shares `daily_reminder` type; both routers send that type to `/expense`; `action_url` ignored. | [daily-items-reminder/route.ts](<../../../src/app/api/cron/daily-items-reminder/route.ts>) · `getActionRoute()` in [useNotifications.ts](<../../../src/hooks/useNotifications.ts>) · [public/sw.js](<../../../public/sw.js>) | 🔴 |
| **`action_url: "/items"` is a dead route** | Even if routing *did* honor `action_url`, it would 404 — the intended destination was never built. | No `src/app/items/page.tsx`; the list lives at `/reminders`. | absence of `src/app/items/` · [reminders/page.tsx](<../../../src/app/reminders/page.tsx>) | 🟠 |
| **`daily_reminder` type is overloaded** | Two different notifications (budget vs items) can't be routed, themed, or filtered apart because they share one type. | One enum value reused for two sources; `source: "system"` is the only distinguisher today. | both crons insert `notification_type: "daily_reminder"` | 🟠 |
| **Budget reminder → expense form** *(works — kept as the reference)* | This is the *correct* behavior; documented so the fix doesn't regress it. | `daily_reminder` (budget) → `/expense` is the desired path. | [daily-reminder/route.ts](<../../../src/app/api/cron/daily-reminder/route.ts>) | ⚪ |

---

## Cluster 3 — Drawer density *(too informative to glance at)*

> The side drawer is the *fast* surface (the alerts page is the detailed one). Today it carries too much.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| **Rows are over-described** | A glance should yield "what + when"; instead each row stacks a title, a 2-line message, a timestamp, and an action block — slow to scan, especially with several unread. | Row template renders title + `line-clamp-2` message + relative time + quick-action block + dismiss + unread dot. | [NotificationModal.tsx](<../../../src/components/notifications/NotificationModal.tsx>) row JSX | 🟠 |
| **Action buttons are wordy** | "Log Now", "Already Done", "Later", "Snooze 15m" as full labelled pills crowd the row and compete with the content. | `getQuickActions()` returns `{icon,label}` and the row renders icon **+ text** for each. | `getQuickActions()` in [useNotifications.ts](<../../../src/hooks/useNotifications.ts>); render in `NotificationModal.tsx` | 🟠 |
| **No grouping/threading** | Five item reminders show as five full rows; the drawer gets long fast. | `group_key` exists in the schema but the drawer renders a flat list. | `notifications.group_key` in [schema.sql](<../../../migrations/schema.sql>); flat map in `NotificationModal.tsx` | 🟡 |
| **No concise empty state** | When clear, the drawer doesn't reinforce the calm "all caught up" feeling. | No dedicated empty-state design beyond an absence of rows. | `NotificationModal.tsx` | ⚪ |

---

## Cluster 4 — Alerts page clutter *(should be descriptive but isn't scannable)*

> The opposite job from the drawer: this page *is* the detailed one — but detailed ≠ a wall of words.

| Pain | Why it hurts | Root cause | Evidence | Sev |
|---|---|---|---|---|
| **Word-dense, low scannability** | The page reads as paragraphs; there's no strong visual hierarchy to skim "what needs me, and how urgent." | Alert rows render title + full message + timestamp with weak type/severity differentiation; the transaction card is especially text-heavy. | alerts render path in [HubPage.tsx](<../../../src/components/hub/HubPage.tsx>) (~5554–5737) | 🟠 |
| **No segmentation / filtering** | Everything (budget, reminders, chat, household) is one undifferentiated stream; I can't jump to "just reminders." | No filter tabs/segments on the alerts view. | `HubPage.tsx` alerts tab | 🟡 |
| **Inconsistent emphasis vs the drawer** | The same notification looks materially different in the drawer vs the page, so the two surfaces don't feel like one system. | Drawer uses Lucide icon circles + theme classes; the alerts page uses emoji icons + severity borders — two visual languages. | `NotificationModal.tsx` vs `HubPage.tsx` | 🟡 |
| **Verify severity borders honor Hard Rule #3** | Hard Rule #3 forbids red on individual rows (only container headers may use red/amber). Need to confirm `getBorderColor(severity)` doesn't paint urgent *rows* red. | `getPriorityBorderColor()` / `getBorderColor()` map severity → border color. | `HubPage.tsx` border helpers | 🟡 |

---

## Cluster 5 — Missed & optimization backlog *(stuff that wasn't asked but should be on the radar)*

> The "what might I have missed / should optimize" list. Captured here so it enters the ranked queue rather than a stray note.

| Pain / opportunity | Why it matters | Evidence | Sev |
|---|---|---|---|
| **`console.*` in the cron routes** | Hard Rule #22 forbids committed `console.*`; the notification crons are heavy offenders and add to the global 649× count. | many `console.log`/`console.error` in [daily-items-reminder/route.ts](<../../../src/app/api/cron/daily-items-reminder/route.ts>), [daily-reminder/route.ts](<../../../src/app/api/cron/daily-reminder/route.ts>), [item-reminders/route.ts](<../../../src/app/api/cron/item-reminders/route.ts>) | 🟠 |
| **No quiet hours / DND / per-type mute** | Best practice for any notification system; avoids 2am pings and lets the user dial down noisy types. | `notification_preferences` stores `preferred_times` but no quiet-hours/mute surface. | [schema.sql](<../../../migrations/schema.sql>) · Preferences module | 🟡 |
| **Dismiss/snooze may lack Undo** | Hard Rule #1 requires every toast to carry Undo; verify dismiss/snooze on drawer + alerts page comply. | dismiss/snooze handlers in `NotificationModal.tsx` / `HubPage.tsx` | 🟡 |
| **No bulk actions beyond "mark all read"** | A long stream needs snooze-all / clear-category, not just mark-all-read. | `NotificationModal.tsx` header | 🟡 |
| **Grouping infrastructure unused** | `group_key` is set by the crons for dedup but never used to *collapse* related notifications in the UI. | crons set `group_key`; no UI grouping | 🟡 |
| **Two visual languages for one system** | Drawer (Lucide + theme) vs alerts page (emoji + severity borders) — unify into one notification design language. | see Cluster 4 | 🟡 |
| **Expiry/auto-cleanup tuning** | `expires_at` is set inconsistently (items summary = 24h; others vary) — confirm a coherent retention policy. | crons' `expires_at` values | ⚪ |

---

## 🎯 Top pains, ranked *(the at-a-glance scope)*

1. **🔴 Daily items summary opens the expense form** instead of the reminders view (mis-typed `daily_reminder` + dead `/items` + type-based routing). *(Cluster 2)*
2. **🟠 Bell rings perpetually + red badge** — distracting, alarm-like, ignores reduced-motion. *(Cluster 1)*
3. **🟠 Drawer rows too dense** — 2-line bodies + worded action pills; not glanceable. *(Cluster 3)*
4. **🟠 Alerts page is a wall of words** — low scannability, no segmentation. *(Cluster 4)*
5. **🟠 `console.*` in notification crons** — Hard Rule #22 hygiene. *(Cluster 5)*
6. **🟡 Backlog:** quiet hours/DND, grouping by `group_key`, bulk actions, Undo on dismiss/snooze, unify the two visual languages. *(Cluster 5)*

→ Where each pain is *heading* + the best-practice rationale + MoSCoW ordering → [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>).
→ What to actually do, and in what order → [3 · Action Plan](<3 - Action Plan.md>); the checkable list → [4 · Checklist](<4 - Checklist.md>).
