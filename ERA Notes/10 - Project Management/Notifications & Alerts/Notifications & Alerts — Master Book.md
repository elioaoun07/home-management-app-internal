---
created: 2026-06-19
updated: 2026-09-06
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

> **ASTRA study landing — 2026-09-06:** [Campaign Book](<ASTRA/Notifications & Alerts — ASTRA Book.md>) · [Packets](<ASTRA/Notifications & Alerts — ASTRA Packets.md>). Accepted source cutoff `3106164`; subordinate to the active Top Layer plan. Pain Inventory corrections below qualify the older state/roadmap wording; this landing implements no product behavior and verifies no live scheduler, Google alarm or phone delivery.

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

- 🟠 **Existing-row deduplication and source advancement can strand delivery, while failed suppression reads can permit an obsolete alert.** Proactive discovery 2026-09-06 at `83e44be`: `src/app/api/cron/chat-notifications/route.ts:231–244` skips an existing notification even after failed first transport; `src/app/api/cron/item-reminders/route.ts:258–275` drops suppression/action query errors into zero, and `:352–357,390–395` can mark fired/advance after all recipient inserts fail. Refine existing E-05a/E-19 with separate source, recipient recovery and suppression evidence; Schedule retains occurrence ownership. [Failure contract](<../Proactive ERA/Proactive ERA — Silence, Trust & Intervention.md>). Source risks only; no live incidence, repair or extra checklist items claimed.

- 🟡 **Bell acceptance still needs device proof; the perpetual-ring claim is stale.** `NotificationBell.tsx:39–68,92–96` already has finite arrival/rest behavior; `globals.css:3712–3743` has one iteration and reduced-motion handling. Theme/urgency and accessible labels are present. Reconcile NOTIF-2.1–2.4 against this source and obtain 390×844 arrival/rest/reduced-motion evidence; do not rebuild it or mark phone acceptance verified from source alone (ASTRA Book, Book delta).
- 🟠 **Drawer rows are over-described** — title + 2-line message + timestamp + worded action pills. A glance should yield "what + when"; instead every row is a paragraph.
- ⚪ **The cron console cleanup conflicts with current Hard Rule 22.** Its corrected scope permits server-side `console.error`; existing locked decision 5 and NOTIF-5.4 still request blanket removal. Record that rule conflict before dispatch and preserve useful server diagnostics; the old 13/9/8 counts are historical, not a current client-rule violation (ASTRA Book, Book delta).
- 🟠 **External cron execution and delivery remain UNVERIFIED.** Missing `vercel.json` does not prove an external scheduler is absent. E-02/E-03 require owner scheduler invocation/response and last-success evidence for the six jobs; NOTIF-6.6 additionally requires advancing Google `last_synced_at`, induced-drift repair and an observed native phone alarm. Source/API acceptance alone closes none of those gates (ASTRA F3).

> **2026-09-06 source correction — daily-summary routing already has its own type.** The 2026-09-02 Shipped Log closes NOTIF-1.1–1.6: `daily_items_summary` resolves to `/reminders` in registry and both service-worker branches. Older “overloaded `daily_reminder`/dead `/items`” state rows are stale; do not queue another routing fix (ASTRA Book, Book delta).

- 🟡 **Registry vs `sw.js` duality** — `sw.js` lives outside the registry, so push can show different text/actions than in-app. Change both sides or neither.
- 🟡 The drawer is still ungrouped even though `group_key` grouping shipped on the alerts page; five item reminders are five rows.
- 🟡 Dismiss/snooze on the drawer and alerts page are silent optimistic mutations with no toast — Hard Rule 1 requires Undo. (The Critical Alert Gate does have it.)
- 🟡 **No unified quiet-hours/DND/mute and recipient-event budget.** NOTIF-19/E-19 must count one logical recipient event before subscription fanout, not one unit per endpoint (`pushSender.ts:98`). Reuse E-05a's identity/claim/outcome contract. Top Layer C01's 07:15 versus 21:00–08:00 conflict and C03's partner sequencing remain held owner decisions; this inventory changes neither policy (ASTRA F4).
- ⚪ Expiry/retention is set inconsistently across types.
- ⚪ Calm empty-state work remains under NOTIF-5.3; the prior “only strong signal is the alarm” rationale is obsolete after the finite-bell source correction above. Preserve Hard Rule 28's minimal copy.

- 🔴 **In-app Done can complete a recurring parent and dismiss a failed action.** `/api/notifications/actions:106–135` updates the notification first, then directly completes its item without occurrence dispatch or checking the item update error. ASTRA-NOTIF-1 removes the unsafe shortcut and opens the item tool; NOTIF-3.2/3.3 remain gated on Schedule's authorized occurrence transition before compact Done/Undo can return (ASTRA F1).
- 🟠 **Push completion has a separate, weakly specified mutation contract.** `sw.js:1269–1285` sends an occurrence date or today's UTC fallback and defaults missing recurrence to false; `/api/items/[id]/complete:92–107,114,159–195` trusts the recurrence flag, has a broader household fallback than creator/responsible/public access and writes separately. These are source defects, not proof of live RLS behavior. Contain push Done in ASTRA-NOTIF-1; Schedule owns authorized atomic completion before restoration (ASTRA F1).
- 🟠 **Stored item alerts lose the occurrence identity carried by push.** `item-reminders/route.ts:337–341` stores item/alert/type metadata while `:369–375` adds occurrence date/recurrence only to the push payload. Old in-app alerts cannot safely reconstruct an intended occurrence from a mutable trigger or today's date. Repair provenance through the existing notification record before notification actions or E-11 claim occurrence correctness (ASTRA F2).
- 🟡 **Some no-send outcomes disappear from delivery counters.** `pushSender.ts:59–80` returns sent=0/failed=0/allFailed=false for missing configuration, query errors or no subscriptions; `item-reminders/route.ts:386–387` counts neither outcome. Later sent>0 means endpoint acceptance, not phone display. E-05a/HUB-42 owns explicit no-send/unknown/accepted outcomes before policy or briefing confidence consumes them (ASTRA F3; Top Layer A12).

## Shipped Log

- ✅ *(date unrecorded, found already fixed 2026-09-02)* — **the daily items summary now opens `/reminders`, not `/expense`.** `daily-items-reminder/route.ts:363` uses its own `daily_items_summary` type (not the shared `daily_reminder`) and `:371/:432` set `action_url`/route to `/reminders`; the registry's `daily_items_summary.resolveRoute()` (`src/lib/notifications/registry.tsx:145-148`) returns `/reminders` and both `useNotifications.ts`'s `getActionRoute()` and `sw.js`'s two `daily_items_summary` branches (`:528`, `:780`) consult it. This closes NOTIF-1.1–1.6 in full — the checklist lines were stale, tracking a bug that no longer existed; swept during the [ERA Top Layer — Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>) ground-truth pass rather than under its own session.
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
