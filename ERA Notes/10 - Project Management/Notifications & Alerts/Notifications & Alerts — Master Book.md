---
created: 2026-09-10
updated: 2026-09-10
type: master-book
status: active
owner: Elio
---

# Notifications & Alerts — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Deliver the right event to the right person and resolving screen. Junction across Schedule, Budget, recurring payments and Hub.

## Current state & evidence

Routing fixes NOTIF-1.1–1.6 are recorded complete in the Sep2 baseline; the original ship date is unspecified. Finite bell motion and urgency styling are source-present but device acceptance remains. Recipient policy, durable delivery and Google physical-alarm proof remain open.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/Notifications & Alerts — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Drawer and Alerts page have distinct density, one visual language and direct resolving destinations. No third notification-centre route, geofencing or new ML-priority project.
- Finite arrival motion, reduced motion and accessible unread labels; theme/person accents, no red individual rows; compact controls and minimal UI text. Source-present behavior needs verification before rebuilding.
- Dismiss/snooze/Done preserve real inverse and occurrence semantics. DEC-05 holds shortcut-versus-navigation choice; DEC-06 holds cron diagnostic policy. This document does not silently waive either legacy rule.
- NOTIF-19 is the sole recipient policy owner. Quiet hours, budget, mute and digest eligibility apply at pushSender; delivery claims/recovery are NOTIF-21. No activation until DEC-01 settles the 07:15/08:00 contradiction.
- Google Calendar transport success/event ID is not proof a locked phone alarm fired. Verify credentials, reconciliation and physical notification behavior under NOTIF-6.6; Schedule owns recurrence projection.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🟠 **NOTIF-19** Centralize recipient delivery policy. See [acceptance](<#notif-19>) for the root cause, evidence and gate.

🟠 **NOTIF-2.1** Verify the bell and unread state on phones. See [acceptance](<#notif-21>) for the root cause, evidence and gate.

🟠 **NOTIF-5.6** Provide real Undo for dismiss and snooze. Dated source diagnosis; cause and witness limits are in [criteria](<#notif-56>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### NOTIF-19

**Outcome:** Centralize recipient delivery policy.

- **Acceptance:** One policy at pushSender.sendPushToUser covers all producers: 21:00–08:00 Beirut quiet hours, 3 pushes/day/user, severity classes, per-type mute/DND preferences, eligible digest overflow and per-recipient decisions. Absorbs HUB-53/HUB-8 and NOTIF-5.7. DEC-01 resolves 07:15 briefing conflict and partner sequencing before activation; policy choice is distinct from durable send recovery (NOTIF-21).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** `src/lib/pushSender.ts` is the right chokepoint and currently enforces nothing but VAPID config and 410/404 deactivation — read `ensureVapidConfigured()`, `sendPushToUser()` and the `PushResult` shape. Eight real producers call it (verified 2026-09-20): the four crons `chat-notifications`, `daily-items-reminder`, `daily-reminder`, `item-reminders`, plus `src/app/api/hub/messages/route.ts`, `src/app/api/notifications/in-app/route.ts`, `.../notifications/test/route.ts` and `src/app/api/pm/notify/route.ts`. **`quiet_start`/`quiet_end` already exist in `src/app/api/notifications/preferences/route.ts`'s Zod schema and are read nowhere else in `src/` — the preference is stored and ignored.** Severity/class vocabulary to reuse rather than reinvent: `src/lib/notifications/registry.tsx` (`NotificationTypeSpec`, `NotificationClass`, `takeoverEligible`). Beirut quiet hours must go through `src/lib/utils/date.ts`, not raw `Date` (Hard Rule #18). DEC-01 gates activation; durable send recovery is NOTIF-21, not this.

### NOTIF-2.1

- **Retained campaign gate (D2):** *(Phase 2)* The bell no longer animates perpetually (finite-on-arrival only), respects `prefers-reduced-motion`, and the unread signal is calm but unambiguous.

**Outcome:** Verify the bell and unread state on phones.

- **Acceptance:** Verify the existing finite arrival animation, calm unread/rest state, urgency-aware readable count, accessible N-unread label and reduced motion on mobile under every theme. Absorbs NOTIF-2.2–2.5; implement only a reproduced discrepancy.

- **Acceptance:** the bell animates once on arrival and then rests; no animation plays while merely unread; `prefers-reduced-motion` yields a static dot/count.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Verification-first — the behaviour is already implemented, so reproduce before editing. `src/components/notifications/NotificationBell.tsx` holds all of it: the `prefers-reduced-motion` media query, the `prevCountRef` effect that sets `justArrived` only when the count *rises*, the `animate-notification-ring` / `animate-notification-badge` classes, and the `Notifications, N unread` aria-label with its urgent suffix. Count source is `useUnreadNotificationCount()` in `src/hooks/useNotifications.ts`. The keyframes live in the global stylesheet, not the component. Implement only a reproduced discrepancy, and verify under all four themes on a mobile viewport (Hard Rules #5, #10).

### NOTIF-3.1

- **Retained campaign gate (D3):** *(Phase 3)* Drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.

**Outcome:** Simplify and verify the notification drawer.

- **Acceptance:** One row tier: icon, title, short context, relative time; full text stays on Alerts. Preserve a minimal empty state, opaque floating panels using tc.bgPage and mobile usability. Absorbs NOTIF-3.4/3.5 and drawer half of NOTIF-5.3. Action controls remain NOTIF-3.2; inverse semantics remain NOTIF-5.6.

- **Acceptance:** each drawer row renders one information tier (icon + title + short context + relative time) with icon/compact actions carrying `aria-label`s, and Undo survives on destructive actions.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The drawer is `src/components/notifications/NotificationCenter.tsx` (row rendering, empty state) with `src/components/notifications/NotificationModal.tsx` for the expanded view; both are exported via `src/components/notifications/index.ts`. Row content vocabulary — icon, title, class, route — comes from `src/lib/notifications/registry.tsx` (`NotificationIconSpec`, `resolveRoute`), so change the registry rather than adding per-row conditionals. Hard Rule #15 applies literally: a floating drawer uses `tc.bgPage` from `useThemeClasses()`, never `neo-card`. Action controls belong to NOTIF-3.2 and Undo semantics to NOTIF-5.6 — don't absorb them.

### NOTIF-3.2

- **Retained campaign gate (D3):** *(Phase 3)* Drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.

**Outcome:** Convert quick actions to **icon-only/compact** controls with `aria-label`/tooltip; one primary inline, secondary in an overflow.

- **Acceptance:** Convert quick actions to **icon-only/compact** controls with `aria-label`/tooltip; one primary inline, secondary in an overflow. → `src/hooks/useNotifications.ts`, `src/components/notifications/NotificationModal.tsx`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Quick actions are typed in `src/lib/notifications/registry.tsx` (`QuickActionId`, `QuickAction`, and each type's action list) and executed by `useCompleteNotificationAction()` in `src/hooks/useNotifications.ts`; the rendering surfaces are `src/components/notifications/NotificationModal.tsx` and the row actions in `NotificationCenter.tsx`. Pick the primary from the registry entry rather than hardcoding per type. Icon-only controls still need Undo on anything destructive (Hard Rule #1, `ToastIcons` from `src/lib/toastIcons.tsx`), and labels follow Hard Rule #28 — a verb, not a sentence.

### NOTIF-6.6

**Outcome:** Live-verify Google Calendar sync end-to-end once credentials are set (connect.

- **Acceptance:** Live-verify Google Calendar sync end-to-end once credentials are set (connect → event appears → native alarm fires → reconcile heals drift). **Blocked on credentials.** Still open: native alarm fires on the phone; reconcile cron heals drift (cron needs an external scheduler — never assume it's live).

- **Acceptance:** with credentials set, connecting produces a Google event, the native alarm fires on the phone, and the reconcile cron heals an induced drift — with a recorded last-run trace proving the cron is actually scheduled.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Blocked on credentials; this is a live-verification outcome, not a code change. Read this so you can tell a real failure from a missing credential: `src/lib/gcal/client.ts` (`isGoogleCalendarConfigured()`, `getOAuth2Client()`, `getAuthUrl()`, `exchangeCodeForTokens()`, `getCalendarClientForUser()`, `isGoogleNotFoundError()`) and `src/lib/gcal/sync.ts` (`syncItemToGoogleCalendar()`, `deleteItemFromGoogleCalendar()`). Which notification types sync at all is the `calendarSync` flag in `src/lib/notifications/registry.tsx`. The drift healer is `src/app/api/cron/gcal-reconcile/route.ts` — it has `maxDuration = 60` and the `Bearer CRON_SECRET` check, but there is no `vercel.json`, so it runs only if an external scheduler calls it. That is exactly why the acceptance demands a recorded last-run trace.

### NOTIF-21

**Outcome:** Recover recipient-event delivery durably.

- **Acceptance:** PE04/ASTRA: durable recipient/event claim distinguishes claimed, delivered, failed and uncertain sends, with idempotent recovery and digest handling. Policy eligibility alone does not prove exactly-once arrival.
- **Depends on:** [NOTIF-19](<Notifications & Alerts — Master Book.md#notif-19>).

**Provenance:** [Notifications & Alerts — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/Notifications & Alerts — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on NOTIF-19 and is a different problem: policy eligibility versus exactly-once arrival. There is no claim record today — `sendPushToUser()` in `src/lib/pushSender.ts` loops subscriptions in-process, counts `sent`/`failed`, deactivates on 410/404 and optionally stamps `notifications.push_status`; a crash mid-loop leaves no durable per-recipient state. Read that loop, `src/lib/pushLogger.ts` (`logPushEvent`, the existing observation trail) and `src/app/api/notifications/subscription-health/route.ts`. The exactly-once discipline to copy is the one in `.claude/skills/recurrence-safety/SKILL.md`: a claim row, idempotent replay, no silent redelivery. Any new table follows Hard Rules #24 and #27 — give it a policy in the same migration.

### NOTIF-4.1

- **Retained campaign gate (D4):** *(Phase 4)* The alerts page reads as scannable cards with clear hierarchy; no red on individual rows; verified on mobile.

**Outcome:** Simplify and verify Alerts cards.

- **Acceptance:** Use title, one short context clause, time and type icon. Preserve the existing page empty state. Restrained person/theme accents, no red individual rows, and mobile top padding clearing fixed headers. Absorbs NOTIF-4.2/4.4 and page half of NOTIF-5.3.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The page is `src/app/alerts/page.tsx`, a single file rendering the date-grouped, `group_key`-deduped list off the same source as the bell (`useInAppNotifications()` in `src/hooks/useNotifications.ts`). Card icon/class/title vocabulary is `src/lib/notifications/registry.tsx`. Three hard rules bind at once: #3 (no red on individual rows — container headers may; overdue labels `text-white/40`), #14 (person-absolute colour derived from `useTheme()`), #16 (fixed header needs matching top padding). Preserve the existing empty state.

### NOTIF-4.3

**Outcome:** Keep the action-first transaction-reminder card but tighten its text + button copy.

- **Acceptance:** Keep the action-first transaction-reminder card but tighten its text + button copy.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Copy-only, and Hard Rule #28 is the whole brief: one- or two-word verbs, no reassurance text, no rationale on screen. The card lives in `src/app/alerts/page.tsx`; its action set and labels come from the transaction-reminder entry in `src/lib/notifications/registry.tsx` (`QuickAction` labels), so change them there and the drawer stays consistent. Do not restructure the action-first layout — that is the part the owner wants kept.

### NOTIF-5.4

- **Retained campaign gate (D5):** Retain and triage every remaining Phase5 outcome; do not call the entire phase complete while its canonical items are open.

**Outcome:** Resolve cron diagnostic policy.

- **Acceptance:** Held for DEC-06: global Hard Rule22 allows server diagnostics while the module’s older locked decision removes all cron logs. Neither is silently waived. Record the owner resolution before the corresponding scoped change.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-06; the deliverable is a recorded owner decision, not an edit. Both sides of the tension are current: Hard Rule #22 permits `console.error` under `src/app/api/` (the Vercel log stream), while this module's older locked decision removed all cron logging. Read the six routes under `src/app/api/cron/` for what diagnostics exist today, and `src/lib/pushLogger.ts` for the structured alternative that already exists. Record the resolution in `_Decisions.md` before any scoped change.

### NOTIF-5.6

- **Retained campaign gate (D5):** Retain and triage every remaining Phase5 outcome; do not call the entire phase complete while its canonical items are open.

- **Retained campaign gate (D3):** *(Phase 3)* Drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.

**Outcome:** Provide real Undo for dismiss and snooze.

- **Acceptance:** Audit drawer and Alerts dismiss/snooze; inverse restores domain state and reports failures honestly, using ToastIcons. Absorbs NOTIF-3.3. Critical Alert Gate already has Undo; do not duplicate it or mistake cache invalidation for an inverse.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Audit first, fix only real gaps. The mutations are all in `src/hooks/useNotifications.ts`: `useDismissNotification()`, `useSnoozeNotification()`, `useArchiveNotification()`, `useCompleteNotificationAction()`. Each PATCHes a flag (`is_dismissed`, `snoozed_until`), so an inverse has to restore *domain* state — invalidating the query cache is not an inverse. `src/components/notifications/CriticalAlertGate.tsx` already implements Undo correctly; read it as the model and do not duplicate it. Toasts follow Hard Rule #1 with `ToastIcons` from `src/lib/toastIcons.tsx`.

### NOTIF-5.8

- **Retained campaign gate (D5):** Retain and triage every remaining Phase5 outcome; do not call the entire phase complete while its canonical items are open.

**Outcome:** Bulk actions: snooze-all, clear-category.

- **Acceptance:** Bulk actions: snooze-all, clear-category.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Build on the single-row mutations in `src/hooks/useNotifications.ts` (`useSnoozeNotification`, `useDismissNotification`) and the existing all-rows precedent `useMarkAllNotificationsRead()` — the closest thing to a bulk endpoint today; check whether it batches server-side or loops. Category comes from the registry type/class in `src/lib/notifications/registry.tsx`, which the filter chips on `src/app/alerts/page.tsx` already group by. A bulk action is the worst place to skip Undo (Hard Rule #1), and `.claude/skills/cache-invalidation/SKILL.md` applies — one invalidation after the batch, not per row.

### NOTIF-20

**Outcome:** Resolve shortcut Done occurrence semantics.

- **Acceptance:** Held for DEC-05: choose one-tap delegation or the full occurrence-action sheet where recurrence needs a choice. Do not silently trade semantic correctness for one fewer tap.
- **Depends on:** [SCH-14](<../Schedule/Schedule — Master Book.md#sch-14>).

**Provenance:** [Notifications & Alerts — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/Notifications & Alerts — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-05 and depends on SCH-14; decide before coding. This is a recurrence-semantics question, so read `.claude/skills/recurrence-safety/SKILL.md` first — the historical failure mode is a shortcut that silently completes the series instead of the occurrence. The shortcut path is the quick actions in `src/lib/notifications/registry.tsx` plus `useCompleteNotificationAction()` in `src/hooks/useNotifications.ts`; the occurrence machinery it would delegate to is under `src/lib/schedule/` (`materializeOccurrence.ts`, `alertResolution.ts`). Record the decision in `_Decisions.md` first.

## Backlog reconciliation

- 2026-09-10 — **HUB-53** → NOTIF-19. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-5.7** → NOTIF-19. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-2.2** → NOTIF-2.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-2.3** → NOTIF-2.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-2.4** → NOTIF-2.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-2.5** → NOTIF-2.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-3.3** → NOTIF-5.6. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-3.4** → NOTIF-3.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-3.5** → NOTIF-3.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-4.2** → NOTIF-4.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-4.4** → NOTIF-4.1. Scope is retained in the destination criteria; duplicate removed, not shipped.
- 2026-09-10 — **NOTIF-5.3** → NOTIF-3.1, NOTIF-4.1. Scope is retained in the destination criteria; duplicate removed, not shipped.

## Shipped Log

- ✅ *(date unrecorded, found already fixed 2026-09-02)* — **the daily items summary now opens `/reminders`, not `/expense`.** `daily-items-reminder/route.ts:363` uses its own `daily_items_summary` type (not the shared `daily_reminder`) and `:371/:432` set `action_url`/route to `/reminders`; the registry's `daily_items_summary.resolveRoute()` (`src/lib/notifications/registry.tsx:145-148`) returns `/reminders` and both `useNotifications.ts`'s `getActionRoute()` and `sw.js`'s two `daily_items_summary` branches (`:528`, `:780`) consult it. This closes NOTIF-1.1–1.6 in full — the checklist lines were stale, tracking a bug that no longer existed; swept during the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>) ground-truth pass rather than under its own session.
- ✅ 2026-07-10 — **notification type registry** (`src/lib/notifications/registry.tsx`): one entry per type drives route, actions, icon, class, `calendarSync`, `takeoverEligible` and retention
- ✅ 2026-07-10 — **alerts page unified** onto the bell's data source: realtime, date-grouped, `group_key`-deduped, filter chips, shared icon vocabulary
- ✅ 2026-07-10 — actions-route column bug fixed (quick actions had silently no-opped for weeks)
- ✅ 2026-07-10 — **critical-alert takeover gate** (`CriticalAlertGate.tsx`) for `item_due` / `item_overdue` / `bill_overdue` / `budget_exceeded` at high/urgent priority, with Undo and a session-scoped "Later"
- ✅ 2026-07-10 — **Google Calendar backup sync** (one-way, Calendar API not ICS) for Scheduled notifications, with three same-day fix passes — including catching its own "code-complete" claim being false when sync never fired from online mutations
- ✅ 2026-07-10 — private-thread exclusion enforced on the immediate Hub push path as well as the cron, closing an owner-only visibility leak; the Budget/Reminder purpose allowlist removed from both paths
- ✅ 2026-07-10 — `console.*` stripped from `/api/notifications/in-app` and `/api/notifications/actions`

Routing NOTIF-1.1–1.6 is recorded complete in the 2026-09-02 baseline. The historical ship date is unrecorded; the stale Phase1 DoD checkbox is retired on that evidence.

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
