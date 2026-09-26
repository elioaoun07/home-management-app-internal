---
created: 2026-09-10
updated: 2026-09-26
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

Item plans use the [execution-plan convention](<../_Conventions.md#9-item-execution-plans>). Read only the selected ID, its declared dependencies and relevant source; planning does not certify deployment or mark work complete.

### NOTIF-19

**Outcome:** Centralize recipient delivery policy.

- **Acceptance:** One policy at pushSender.sendPushToUser covers all producers: 21:00–08:00 Beirut quiet hours, 3 pushes/day/user, severity classes, per-type mute/DND preferences, eligible digest overflow and per-recipient decisions. Absorbs HUB-53/HUB-8 and NOTIF-5.7. DEC-01 resolves 07:15 briefing conflict and partner sequencing before activation; policy choice is distinct from durable send recovery (NOTIF-21).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** `src/lib/pushSender.ts` is the right chokepoint and currently enforces nothing but VAPID config and 410/404 deactivation — read `ensureVapidConfigured()`, `sendPushToUser()` and the `PushResult` shape. Eight real producers call it (verified 2026-09-20): the four crons `chat-notifications`, `daily-items-reminder`, `daily-reminder`, `item-reminders`, plus `src/app/api/hub/messages/route.ts`, `src/app/api/notifications/in-app/route.ts`, `.../notifications/test/route.ts` and `src/app/api/pm/notify/route.ts`. **`quiet_start`/`quiet_end` already exist in `src/app/api/notifications/preferences/route.ts`'s Zod schema and are read nowhere else in `src/` — the preference is stored and ignored.** Severity/class vocabulary to reuse rather than reinvent: `src/lib/notifications/registry.tsx` (`NotificationTypeSpec`, `NotificationClass`, `takeoverEligible`). Beirut quiet hours must go through `src/lib/utils/date.ts`, not raw `Date` (Hard Rule #18). DEC-01 gates activation; durable send recovery is NOTIF-21, not this.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft; briefing activation held on DEC-01.

**Verify:** Proposed policy fixtures: 20:59/21:00/07:59/08:00 Beirut, DST, pushes 1–4, simultaneous attempts, per-type mute/DND, two recipients and eligible digest overflow. Exercise every producer with injected push; run `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "All push producers apply one recipient policy before sending.",
  "acceptance": [
    "One boundary enforces Beirut quiet hours, three pushes/day/person, classes, mute/DND and digest eligibility.",
    "Each recipient's own preferences apply; DEC-01 is resolved before briefing activation."
  ],
  "scope": [
    "src/lib/pushSender.ts",
    "src/lib/notifications",
    "src/app/api/notifications/preferences/route.ts",
    "src/app/api/cron",
    "src/app/api/hub/messages/route.ts",
    "src/app/api/notifications/in-app/route.ts",
    "src/app/api/notifications/test/route.ts",
    "src/app/api/pm/notify/route.ts"
  ],
  "steps": [
    "Inventory the eight existing producers and classify each with the registry; implement the already-accepted 21:00–08:00 policy and three-event cap independently of briefing activation.",
    "Create a proposed pure recipient-policy evaluator and structured decision result, reusing stored preferences and IANA time; leave unspecified exemptions disabled pending a decision.",
    "Enforce that result once inside sendPushToUser before fan-out; preserve producer-level private/read exclusions.",
    "Make cap accounting race-safe and route eligible overflow to the agreed digest contract; keep briefing activation disabled until DEC-01 resolves its hour and partner sequencing."
  ],
  "invariants": [
    "Three pushes means recipient events, not a separate budget for each device subscription.",
    "Muted/ineligible events cannot become push attempts through test or PM producers.",
    "Policy eligibility is not proof of durable delivery."
  ],
  "exclusions": [
    "Independent producer policies, silently exempting urgent sends or implementing NOTIF-21's complete recovery mechanism here."
  ],
  "risks": [
    "A read-count-then-send cap can exceed three under simultaneous producers."
  ],
  "unknowns": [
    "DEC-01 and any unspecified severity exemption; storage/application evidence for atomic budget accounting."
  ],
  "dependencies": [
    "DEC-01"
  ],
  "risk": "high",
  "provenance": "2026-09-26 source: pushSender.ts:46-190 and eight call sites reviewed; preferences route stores quiet_start/quiet_end. No runtime policy or DB claim.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-2.1

- **Retained campaign gate (D2):** *(Phase 2)* The bell no longer animates perpetually (finite-on-arrival only), respects `prefers-reduced-motion`, and the unread signal is calm but unambiguous.

**Outcome:** Verify the bell and unread state on phones.

- **Acceptance:** Verify the existing finite arrival animation, calm unread/rest state, urgency-aware readable count, accessible N-unread label and reduced motion on mobile under every theme. Absorbs NOTIF-2.2–2.5; implement only a reproduced discrepancy.

- **Acceptance:** the bell animates once on arrival and then rests; no animation plays while merely unread; `prefers-reduced-motion` yields a static dot/count.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Verification-first — the behaviour is already implemented, so reproduce before editing. `src/components/notifications/NotificationBell.tsx` holds all of it: the `prefers-reduced-motion` media query, the `prevCountRef` effect that sets `justArrived` only when the count *rises*, the `animate-notification-ring` / `animate-notification-badge` classes, and the `Notifications, N unread` aria-label with its urgent suffix. Count source is `useUnreadNotificationCount()` in `src/hooks/useNotifications.ts`. The keyframes live in the global stylesheet, not the component. Implement only a reproduced discrepancy, and verify under all four themes on a mobile viewport (Hard Rules #5, #10).


**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** At 390×844 test 0→1→same unread→0, urgent count, 99+, reduced motion and rapid arrivals across blue/pink/frost/calm. Verify aria-label/count and that animation stops; use isolated/mock notification data. Run `pnpm typecheck` and `pnpm lint` only if code changes.

```delivery-plan-v1
{
  "outcome": "The existing bell's finite arrival motion and unread state pass mobile and accessibility verification.",
  "acceptance": [
    "One arrival animation ends; merely remaining unread does not animate repeatedly.",
    "Reduced motion is static; unread/urgent label and count stay readable on each theme."
  ],
  "scope": [
    "src/components/notifications/NotificationBell.tsx",
    "src/app/globals.css"
  ],
  "steps": [
    "Read current bell count transition effects and global animation/reduced-motion rules; treat source presence as a starting point, not phone acceptance.",
    "Exercise the transition matrix with controlled notification data, including loading and repeated rapid increments.",
    "If a discrepancy reproduces, change only the implicated timer/class/style and retest the failed case plus ordinary arrival.",
    "Record mobile captures and exact revision; keep owner phone acceptance separate from local viewport results."
  ],
  "invariants": [
    "Do not rebuild behavior already present.",
    "The unread count's source and notification domain actions remain unchanged.",
    "No production notification is sent merely to obtain a UI fixture."
  ],
  "exclusions": [
    "Drawer redesign, push policy or new notification-center route."
  ],
  "risks": [
    "Rapid count changes may expose timer cleanup states that a single arrival cannot reveal."
  ],
  "unknowns": [
    "Physical phone rendering/assistive behavior has not been observed by this plan."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 source: NotificationBell.tsx:34-67,86-97,126-133; globals.css:3711-3716,3743-3754 provides finite animation and reduced-motion override. No reproduced discrepancy or device pass claimed.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-3.1

- **Retained campaign gate (D3):** *(Phase 3)* Drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.

**Outcome:** Simplify and verify the notification drawer.

- **Acceptance:** One row tier: icon, title, short context, relative time; full text stays on Alerts. Preserve a minimal empty state, opaque floating panels using tc.bgPage and mobile usability. Absorbs NOTIF-3.4/3.5 and drawer half of NOTIF-5.3. Action controls remain NOTIF-3.2; inverse semantics remain NOTIF-5.6.

- **Acceptance:** each drawer row renders one information tier (icon + title + short context + relative time) with icon/compact actions carrying `aria-label`s, and Undo survives on destructive actions.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The drawer is `src/components/notifications/NotificationCenter.tsx` (row rendering, empty state) with `src/components/notifications/NotificationModal.tsx` for the expanded view; both are exported via `src/components/notifications/index.ts`. Row content vocabulary — icon, title, class, route — comes from `src/lib/notifications/registry.tsx` (`NotificationIconSpec`, `resolveRoute`), so change the registry rather than adding per-row conditionals. Hard Rule #15 applies literally: a floating drawer uses `tc.bgPage` from `useThemeClasses()`, never `neo-card`. Action controls belong to NOTIF-3.2 and Undo semantics to NOTIF-5.6 — don't absorb them.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Verify 390×844 rows with long title/context, unread/urgent state, no notifications, offline cached data and each theme. Check a real resolving destination and existing Undo after dismissal. Run `pnpm typecheck` and `pnpm lint`; avoid mirror-only UI tests.

```delivery-plan-v1
{
  "outcome": "The notification drawer presents one compact, readable row tier.",
  "acceptance": [
    "Each row has icon, title, short context and relative time; fuller text remains on Alerts.",
    "The empty state stays minimal, floating panels opaque and mobile controls usable."
  ],
  "scope": [
    "src/components/notifications/NotificationCenter.tsx",
    "src/components/notifications/NotificationModal.tsx"
  ],
  "steps": [
    "Inspect both actual drawer surfaces and registry-derived presentation; identify duplicated tiers without changing notification meaning.",
    "Reduce each row to the accepted information set and bound long context/title overflow.",
    "Use tc.bgPage on floating panels; preserve the single drawer transition, cached content and resolving navigation.",
    "Verify density and all current actions/inverses on mobile; leave action hierarchy to NOTIF-3.2 and inverse fixes to NOTIF-5.6."
  ],
  "invariants": [
    "No extra explanatory text or hidden mandatory action.",
    "Unread/read state and real domain inverses are preserved.",
    "Cached drawer content is not delayed until animation completion."
  ],
  "exclusions": [
    "Alerts-page card redesign, notification grouping/policy changes or absorbing other canonical items."
  ],
  "risks": [
    "Removing context mechanically can erase which record a similarly titled alert targets."
  ],
  "unknowns": [
    "Which surface is currently mounted and which text fields are redundant must be checked before editing."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from Notifications acceptance, reading guides, registry architecture and accepted Top Layer constraints; entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-3.2

- **Retained campaign gate (D3):** *(Phase 3)* Drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.

**Outcome:** Convert quick actions to **icon-only/compact** controls with `aria-label`/tooltip; one primary inline, secondary in an overflow.

- **Acceptance:** Convert quick actions to **icon-only/compact** controls with `aria-label`/tooltip; one primary inline, secondary in an overflow. → `src/hooks/useNotifications.ts`, `src/components/notifications/NotificationModal.tsx`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Quick actions are typed in `src/lib/notifications/registry.tsx` (`QuickActionId`, `QuickAction`, and each type's action list) and executed by `useCompleteNotificationAction()` in `src/hooks/useNotifications.ts`; the rendering surfaces are `src/components/notifications/NotificationModal.tsx` and the row actions in `NotificationCenter.tsx`. Pick the primary from the registry entry rather than hardcoding per type. Icon-only controls still need Undo on anything destructive (Hard Rule #1, `ToastIcons` from `src/lib/toastIcons.tsx`), and labels follow Hard Rule #28 — a verb, not a sentence.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** At 390×844 verify one inline primary action, keyboard/touch overflow, accessible labels, focus/closing behavior and each registry action's real effect. Confirm existing Undo and error outcomes; run `pnpm typecheck`, `pnpm lint` and affected existing action tests if present.

```delivery-plan-v1
{
  "outcome": "Notification quick actions use one compact primary control and an accessible secondary overflow.",
  "acceptance": [
    "Every icon-only control has an aria-label and available tooltip/name.",
    "Registry action meaning, actual destination and destructive-action Undo are preserved."
  ],
  "scope": [
    "src/lib/notifications/registry.tsx",
    "src/components/notifications/NotificationCenter.tsx",
    "src/components/notifications/NotificationModal.tsx"
  ],
  "steps": [
    "Read registry quick-action ordering and the existing useCompleteNotificationAction contract; identify the primary for each type.",
    "Render one primary inline and put remaining actions in an opaque overflow using existing UI primitives.",
    "Keep handlers bound to the same notification/action identity and preserve pending/error/Undo behavior.",
    "Verify keyboard, touch, labels and mobile hit targets; route any recurrence Done ambiguity to DEC-05/NOTIF-20."
  ],
  "invariants": [
    "Compact controls cannot change occurrence semantics.",
    "Buttons remain short verbs; icons do not remove accessible names.",
    "Do not edit src/components/ui or rewrite the action hooks without a reproduced need."
  ],
  "exclusions": [
    "Changing Done semantics, adding actions, real-inverse repair NOTIF-5.6 or drawer content ownership NOTIF-3.1."
  ],
  "risks": [
    "A visual rearrangement can accidentally bind an action to the wrong row or hide its pending state."
  ],
  "unknowns": [
    "Current registry ordering must be confirmed; ambiguous primary choice should be recorded before changing its meaning."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 planning from Notifications acceptance, reading guides, registry architecture and accepted Top Layer constraints; entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-6.6

**Outcome:** Live-verify Google Calendar sync end-to-end once credentials are set (connect.

- **Acceptance:** Live-verify Google Calendar sync end-to-end once credentials are set (connect → event appears → native alarm fires → reconcile heals drift). **Blocked on credentials.** Still open: native alarm fires on the phone; reconcile cron heals drift (cron needs an external scheduler — never assume it's live).

- **Acceptance:** with credentials set, connecting produces a Google event, the native alarm fires on the phone, and the reconcile cron heals an induced drift — with a recorded last-run trace proving the cron is actually scheduled.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Blocked on credentials; this is a live-verification outcome, not a code change. Read this so you can tell a real failure from a missing credential: `src/lib/gcal/client.ts` (`isGoogleCalendarConfigured()`, `getOAuth2Client()`, `getAuthUrl()`, `exchangeCodeForTokens()`, `getCalendarClientForUser()`, `isGoogleNotFoundError()`) and `src/lib/gcal/sync.ts` (`syncItemToGoogleCalendar()`, `deleteItemFromGoogleCalendar()`). Which notification types sync at all is the `calendarSync` flag in `src/lib/notifications/registry.tsx`. The drift healer is `src/app/api/cron/gcal-reconcile/route.ts` — it has `maxDuration = 60` and the `Bearer CRON_SECRET` check, but there is no `vercel.json`, so it runs only if an external scheduler calls it. That is exactly why the acceptance demands a recorded last-run trace.


**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Owner records connect→event create/update→phone alarm with app closed→induced drift→scheduled reconcile repair. Include exact deployed revision, device/app versions, expected local time and authenticated last-run evidence; credentials/tokens are never pasted into PM docs.

```delivery-plan-v1
{
  "outcome": "Google Calendar backup sync has end-to-end device and scheduled-repair evidence.",
  "acceptance": [
    "A connected account produces the intended Google event and a physical phone alarm.",
    "An induced safe test drift is repaired by an actually scheduled reconcile run with a recorded trace."
  ],
  "scope": [],
  "steps": [
    "Recheck the current Google setup runbook and owner credential readiness; distinguish missing configuration from a code defect.",
    "Owner connects a testable account and exercises create/update using the application; record event identity and timing without secrets.",
    "Owner observes the alarm while the app is closed/phone locked, then runs the agreed bounded drift/reconcile scenario.",
    "Attach actual scheduler/last-run proof and results; create only a scoped engineering follow-up for a reproduced failure."
  ],
  "invariants": [
    "Event ID or successful transport is not alarm proof.",
    "Calendar remains one-way backup; Schedule owns recurrence projection.",
    "Agent inspection does not authorize live Calendar/production mutations."
  ],
  "exclusions": [
    "New Calendar features, two-way sync, native shell implementation or claiming stale credentials remain configured."
  ],
  "risks": [
    "Expired OAuth consent or disabled device notifications can fail independently of application sync."
  ],
  "unknowns": [
    "Current credentials, external scheduler and phone notification settings require the owner."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26 planning from Notifications acceptance, reading guides, registry architecture and accepted Top Layer constraints; entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-21

**Outcome:** Recover recipient-event delivery durably.

- **Acceptance:** PE04/ASTRA: durable recipient/event claim distinguishes claimed, delivered, failed and uncertain sends, with idempotent recovery and digest handling. Policy eligibility alone does not prove exactly-once arrival.
- **Depends on:** [NOTIF-19](<Notifications & Alerts — Master Book.md#notif-19>).

**Provenance:** [Notifications & Alerts — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/Notifications & Alerts — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on NOTIF-19 and is a different problem: policy eligibility versus exactly-once arrival. There is no claim record today — `sendPushToUser()` in `src/lib/pushSender.ts` loops subscriptions in-process, counts `sent`/`failed`, deactivates on 410/404 and optionally stamps `notifications.push_status`; a crash mid-loop leaves no durable per-recipient state. Read that loop, `src/lib/pushLogger.ts` (`logPushEvent`, the existing observation trail) and `src/app/api/notifications/subscription-health/route.ts`. The exactly-once discipline to copy is the one in `.claude/skills/recurrence-safety/SKILL.md`: a claim row, idempotent replay, no silent redelivery. Any new table follows Hard Rules #24 and #27 — give it a policy in the same migration.


**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed isolated fixtures cover overlapping claims, crash before send, response loss after send, partial device fan-out, definitive failure, expired claim and digest replay. Run `pnpm typecheck` and `pnpm lint`; owner separately verifies applied storage and real arrival behavior.

```delivery-plan-v1
{
  "outcome": "Recipient/event delivery has durable state and recovery that preserves uncertainty.",
  "acceptance": [
    "One durable identity tracks claimed, delivered, failed and uncertain states per recipient/event.",
    "Idempotent recovery and digest handling reuse the same identity; policy eligibility never becomes proof of arrival."
  ],
  "scope": [
    "src/lib/pushSender.ts",
    "src/lib/pushLogger.ts",
    "src/lib/notifications",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read NOTIF-19's policy output and current fan-out loop; specify atomic claim identity and the exact meaning of delivered versus provider-accepted.",
    "Dispatch the proposed claim migration/state machine first, with access control, lease/recovery transitions and isolated concurrency fixtures.",
    "Integrate claim/recovery around push fan-out, preserving per-device outcomes and uncertain sends instead of blindly resending them.",
    "Add digest recovery using the same event/recipient identity and a bounded operator/owner reconciliation path for ambiguity."
  ],
  "invariants": [
    "A crash after provider acceptance cannot be assumed unsent.",
    "Two concurrent workers cannot both own a live claim.",
    "Observation logs are evidence, not the transaction/claim authority."
  ],
  "exclusions": [
    "A guarantee of exactly-once physical arrival from a provider ACK, second recipient policy or automatic uncertain redelivery."
  ],
  "risks": [
    "External push acceptance and local commit cannot be one atomic transaction; recovery must explicitly represent that gap."
  ],
  "unknowns": [
    "Accepted delivered-state evidence, lease duration and uncertain-send resolution need explicit decisions before activation."
  ],
  "dependencies": [
    "NOTIF-19"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from Notifications acceptance, reading guides, registry architecture and accepted Top Layer constraints; entry points require dispatch-time revalidation. No runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-4.1

- **Retained campaign gate (D4):** *(Phase 4)* The alerts page reads as scannable cards with clear hierarchy; no red on individual rows; verified on mobile.

**Outcome:** Simplify and verify Alerts cards.

- **Acceptance:** Use title, one short context clause, time and type icon. Preserve the existing page empty state. Restrained person/theme accents, no red individual rows, and mobile top padding clearing fixed headers. Absorbs NOTIF-4.2/4.4 and page half of NOTIF-5.3.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The card implementation is `AlertsView` in `src/components/hub/HubPage.tsx` (source read 2026-09-26), with `useInAppNotifications()`, date grouping and `group_key` deduplication. `src/app/alerts/page.tsx` is only the standalone HubPage wrapper with top padding. Use `src/lib/notifications/registry.tsx` for shared icons/class vocabulary. Preserve the empty state, actions and source data; verify no red individual rows, person/theme identity and fixed-header clearance at a mobile viewport. Do not perform a broad HubPage extraction for this style change.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** At 390×844 verify long/short cards, empty state, date groups, unread/urgent states, all themes and fixed-header clearance. Check existing action destinations remain usable; run `pnpm typecheck` and `pnpm lint`. No new tests are needed for unchanged data logic.

```delivery-plan-v1
{
  "outcome": "Alerts cards have one clear, compact hierarchy without changing notification behavior.",
  "acceptance": [
    "Cards show title, one short context clause, time and type icon with restrained person/theme accents.",
    "Preserve the existing empty state, grouping and actions; no red individual rows or overlapping fixed header."
  ],
  "scope": [
    "src/components/hub/HubPage.tsx",
    "src/app/alerts/page.tsx"
  ],
  "steps": [
    "Open AlertsView in HubPage and identify the actual card branches; the /alerts page is only the standalone wrapper.",
    "Reduce duplicated card text/tiers while preserving the context needed to identify the target record.",
    "Use registry icons/class vocabulary and existing theme/person colors; change wrapper spacing only if the mobile check shows overlap.",
    "Verify normal and transaction-reminder cards, empty state and real action navigation with controlled notification data."
  ],
  "invariants": [
    "Grouping/deduplication and unread semantics remain unchanged.",
    "Opaque styling applies to floating controls, not a blanket ban on normal card styling.",
    "No broad HubPage extraction or layout redesign."
  ],
  "exclusions": [
    "Quick-action hierarchy NOTIF-3.2, transaction-card wording NOTIF-4.3 and inverse repair NOTIF-5.6."
  ],
  "risks": [
    "Editing only the wrapper cannot change the cards; removing context can make similar alerts indistinguishable."
  ],
  "unknowns": [
    "Which current card branches need simplification must be verified visually before editing."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26: alerts/page.tsx read as a HubPage wrapper with pt-16; AlertsView begins at HubPage.tsx:5678 and renders grouped cards. No visual regression demonstrated.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-4.3

**Outcome:** Keep the action-first transaction-reminder card but tighten its text + button copy.

- **Acceptance:** Keep the action-first transaction-reminder card but tighten its text + button copy.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The action-first `daily_reminder` special card is in `src/components/hub/HubPage.tsx`, not the thin `/alerts` wrapper. Its All Done/Log Now/Snooze/Change Time labels are local; registry labels drive other quick-action consumers. Notification title/message text is produced by `src/app/api/cron/daily-reminder/route.ts`. Shorten the actual source of each string while preserving handler meaning and layout; preview shared registry/producer consumers when touching shared copy. Hard Rule28 supplies the wording boundary.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Compare before/after at 390×844 with short and long reminder text and each theme; verify all existing buttons call the same handlers. Run `pnpm typecheck` and `pnpm lint` after the copy-only change. Do not add tests mirroring unchanged labels.

```delivery-plan-v1
{
  "outcome": "The existing transaction-reminder card keeps its action-first layout with shorter copy.",
  "acceptance": [
    "Button labels are direct one- or two-word verbs and context is no longer than needed.",
    "Confirm/log/snooze/time-change actions and their order retain the accepted behavior."
  ],
  "scope": [
    "src/components/hub/HubPage.tsx",
    "src/lib/notifications/registry.tsx",
    "src/app/api/cron/daily-reminder/route.ts"
  ],
  "steps": [
    "Inspect the daily_reminder special card in AlertsView and distinguish its local labels from registry labels reused elsewhere.",
    "Shorten verbose copy at its actual source: local card labels or the daily-reminder producer title/message; preserve the accepted action-first structure.",
    "Change a registry label only where that actual shared action wording needs the same correction; preview its drawer consumers.",
    "Verify wrapping, accessible names and handler identity so the wording cannot imply a financial action the button does not perform."
  ],
  "invariants": [
    "Copy does not alter notification completion, transaction posting or snooze duration.",
    "No explanatory reassurance or design rationale is added to the UI.",
    "A concise label must still describe the action honestly."
  ],
  "exclusions": [
    "Restructuring cards, changing handlers, new confirmation dialogs or a broad notification copy pass."
  ],
  "risks": [
    "The special transaction-reminder branch does not obtain all labels from the registry, so changing only the registry may have no effect."
  ],
  "unknowns": [
    "Exact current redundant wording is a visual/editorial check, not a new product decision."
  ],
  "dependencies": [],
  "risk": "low",
  "provenance": "2026-09-26: HubPage.tsx:5963-6040 special daily_reminder card inspected; All Done/Log Now/Snooze/Change Time are local labels. /alerts is a wrapper.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-5.4

- **Retained campaign gate (D5):** Retain and triage every remaining Phase5 outcome; do not call the entire phase complete while its canonical items are open.

**Outcome:** Resolve cron diagnostic policy.

- **Acceptance:** Held for DEC-06: global Hard Rule22 allows server diagnostics while the module’s older locked decision removes all cron logs. Neither is silently waived. Record the owner resolution before the corresponding scoped change.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-06; the deliverable is a recorded owner decision, not an edit. Both sides of the tension are current: Hard Rule #22 permits `console.error` under `src/app/api/` (the Vercel log stream), while this module's older locked decision removed all cron logging. Read the six routes under `src/app/api/cron/` for what diagnostics exist today, and `src/lib/pushLogger.ts` for the structured alternative that already exists. Record the resolution in `_Decisions.md` before any scoped change.


**Execution plan — 2026-09-26**

**Readiness:** investigation first; diagnostic change held on DEC-06.

**Verify:** Inventory current cron diagnostics and structured push logging with source references; compare retain/amend options against the accepted no-log decision and Hard Rule22. After recording the owner's choice run `pnpm pm:lint` and `pnpm pm:check-docs`; code checks belong to any later scoped change.

```delivery-plan-v1
{
  "outcome": "One recorded decision resolves the conflicting cron diagnostic rules.",
  "acceptance": [
    "DEC-06 explicitly retains or amends the module-specific logging ban.",
    "HUB-38 and later cron changes can follow a clear, consistent diagnostic contract."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Notifications & Alerts/Notifications & Alerts — Master Book.md"
  ],
  "steps": [
    "Inventory existing diagnostics across the six cron routes and distinguish operational run evidence from console/push observation logs.",
    "State the precise conflict: global permission for server diagnostics does not silently override the older module-specific ban.",
    "Present the smallest owner choice with its liveness/debugging impact; keep both current constraints intact until recorded.",
    "Record the selected rule and affected HUB-38 boundary, then define a separate exact implementation scope only if code changes are required."
  ],
  "invariants": [
    "No inferred waiver from logs already present in source.",
    "No logging of secrets or sensitive payloads is proposed to solve liveness.",
    "A documentation decision is not proof a scheduled job ran."
  ],
  "exclusions": [
    "Removing or adding logs before the decision, rewriting all crons or deploying a new telemetry service."
  ],
  "risks": [
    "Treating a shared run ledger as automatically exempt may preserve the same unresolved policy conflict."
  ],
  "unknowns": [
    "Owner resolution of DEC-06; read-only inventory is independently executable."
  ],
  "dependencies": [
    "DEC-06"
  ],
  "risk": "medium",
  "provenance": "2026-09-26: decision register and accepted conflict reviewed; scoped rg found existing console diagnostics in cron sources. No rule waived or logging changed.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-5.6

- **Retained campaign gate (D5):** Retain and triage every remaining Phase5 outcome; do not call the entire phase complete while its canonical items are open.

- **Retained campaign gate (D3):** *(Phase 3)* Drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.

**Outcome:** Provide real Undo for dismiss and snooze.

- **Acceptance:** Audit drawer and Alerts dismiss/snooze; inverse restores domain state and reports failures honestly, using ToastIcons. Absorbs NOTIF-3.3. Critical Alert Gate already has Undo; do not duplicate it or mistake cache invalidation for an inverse.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Trace `useDismissNotification`, `useSnoozeNotification` and the actual `useNotificationQuickAction` callers in `src/hooks/useNotifications.ts`, `NotificationModal.tsx` and HubPage's AlertsView. An inverse must restore the prior domain state and check the response, not merely invalidate queries. CriticalAlertGate has an existing Undo affordance, but source inspection on 2026-09-26 shows its helper resets flags to false/null and does not inspect the PATCH status; do not cite that as verified inverse correctness or blindly copy it. Keep the accepted drawer/Alerts scope and ToastIcons; separate Schedule Done semantics under NOTIF-20.


**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Proposed inverse fixtures cover prior read/dismiss/snooze state, successful inverse, 404/500 response, uncertain result and mixed surfaces. Assert real persisted restoration and truthful failure; run `pnpm typecheck` and `pnpm lint`, then verify drawer/Alerts Undo on mobile with isolated data.

```delivery-plan-v1
{
  "outcome": "Dismiss and snooze Undo restore the correct prior notification state and report failures honestly.",
  "acceptance": [
    "Drawer and Alerts expose a real inverse for the accepted actions using ToastIcons.",
    "Inverse success requires confirmed domain restoration; invalidation or a resolved fetch promise alone is insufficient."
  ],
  "scope": [
    "src/hooks/useNotifications.ts",
    "src/components/notifications/NotificationCenter.tsx",
    "src/components/notifications/NotificationModal.tsx",
    "src/components/hub/HubPage.tsx",
    "src/app/api/notifications/in-app/route.ts"
  ],
  "steps": [
    "Trace actual dismiss/snooze branches, including useNotificationQuickAction and the special Alerts card; capture each action's prior domain state.",
    "Inspect CriticalAlertGate as an existing affordance, not proof that resetting false/null is an exact inverse; avoid duplicating its UI.",
    "Implement the smallest missing inverse contract and checked mutation response, using safeFetch for touched mutations.",
    "Restore/cache-refresh every affected surface and preserve failed/uncertain outcomes rather than claiming all changes were undone."
  ],
  "invariants": [
    "Undo restores the prior state, not a guessed default.",
    "A rejected inverse never displays successful completion.",
    "Notification-only changes cannot pretend to reverse an underlying Schedule action."
  ],
  "exclusions": [
    "Done occurrence semantics NOTIF-20, broad hook cleanup or unrelated Critical Gate behavior changes."
  ],
  "risks": [
    "Current Critical Gate Undo does not check HTTP status; copying that pattern would perpetuate false success."
  ],
  "unknowns": [
    "Which routes alter additional domain state must be verified before selecting the inverse fields."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26: useNotifications dismiss/snooze and quick-action callers inspected; CriticalAlertGate.tsx:76-89 resets flags without response inspection. This is source evidence, not a production incident.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-5.8

- **Retained campaign gate (D5):** Retain and triage every remaining Phase5 outcome; do not call the entire phase complete while its canonical items are open.

**Outcome:** Bulk actions: snooze-all, clear-category.

- **Acceptance:** Bulk actions: snooze-all, clear-category.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Start with `useMarkAllNotificationsRead()` in `src/hooks/useNotifications.ts`: it already sends an IDs array in one PATCH to `/api/notifications/in-app`. Confirm that route's batch validation and ownership semantics before extending it. The live category/filter/grouping UI is HubPage's AlertsView, not the thin `/alerts` wrapper. Define whether all means loaded, selected or all authorized rows before implementing an ambiguous batch. Reuse NOTIF-5.6's real prior-state inverse and invalidate once after the batch, retaining partial/uncertain outcomes.


**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Proposed batch fixtures cover selected category, empty set, mixed ownership, partial failure, repeat request and one real bulk Undo. Verify one final invalidation and mobile selection clarity; run `pnpm typecheck` and `pnpm lint` and actual hook/route fixtures once added.

```delivery-plan-v1
{
  "outcome": "Notifications support bounded snooze-all and clear-category actions with truthful batch results.",
  "acceptance": [
    "Only the intended recipient/category set is affected, with one recoverable batch result.",
    "Each changed row can be restored to its prior state; partial or uncertain completion is not reported as all done."
  ],
  "scope": [
    "src/hooks/useNotifications.ts",
    "src/app/api/notifications/in-app/route.ts",
    "src/components/notifications/NotificationModal.tsx",
    "src/components/hub/HubPage.tsx"
  ],
  "steps": [
    "Read useMarkAllNotificationsRead's existing ids-based PATCH precedent and current category/filter semantics.",
    "Resolve what 'all' and 'category' include only where the current UI is ambiguous; freeze the selected IDs and prior states at action time.",
    "Extend the existing server batch boundary with ownership/input validation and accurate per-row or atomic results; use one touched safeFetch mutation.",
    "Provide compact controls and a real batch inverse, then invalidate affected notification views once after the batch settles."
  ],
  "invariants": [
    "A filtered action cannot silently include hidden pages/categories.",
    "Concurrent new notifications are not swept into an already-confirmed ID set.",
    "Undo and retry retain original identities and prior snooze timestamps."
  ],
  "exclusions": [
    "A new queue, deleting notification history, blanket clear-all or repeating single-row invalidation for every row."
  ],
  "risks": [
    "Client-side loaded rows may not represent the whole category; broad server selection can unexpectedly expand scope."
  ],
  "unknowns": [
    "Accepted scope of 'all' and category vocabulary if existing filters do not make it unambiguous."
  ],
  "dependencies": [
    "NOTIF-5.6"
  ],
  "risk": "high",
  "provenance": "2026-09-26: useMarkAllNotificationsRead posts ids in one PATCH; real AlertsView/filter/grouping is in HubPage.tsx. Batch inverse/selection requires implementation-time contract verification.",
  "checks": [],
  "ownerReviewed": false
}
```

### NOTIF-20

**Outcome:** Resolve shortcut Done occurrence semantics.

- **Acceptance:** Held for DEC-05: choose one-tap delegation or the full occurrence-action sheet where recurrence needs a choice. Do not silently trade semantic correctness for one fewer tap.
- **Depends on:** [SCH-14](<../Schedule/Schedule — Master Book.md#sch-14>).

**Provenance:** [Notifications & Alerts — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Notifications & Alerts/Notifications & Alerts — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-05 and dependent on SCH-14. Trace registry `complete_task` through `useNotificationQuickAction()` in `src/hooks/useNotifications.ts` and the actions route; `useCompleteNotificationAction()` only marks notification flags and is not the Schedule completion authority. Compare navigation to the full occurrence sheet with a shortcut that delegates the same occurrence identity/Undo contract. Record the owner's interaction choice before changing behavior; never guess a recurring occurrence or update the series parent blindly.


**Execution plan — 2026-09-26**

**Readiness:** investigation first; shortcut semantics held on DEC-05.

**Verify:** Prepare one-time/recurring/postponed occurrence examples against SCH-14's identity/Undo contract. After DEC-05, proposed integration fixtures assert the selected occurrence changes once, series stays intact, stale target refuses and Undo reverses correctly; run Schedule tests/`pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "Notification Done follows an owner-selected interaction while preserving full occurrence semantics.",
  "acceptance": [
    "DEC-05 chooses navigation to the action sheet or a shortcut with the same semantic guarantees.",
    "The resolved action uses Schedule occurrence identity and real inverse rather than updating a parent blindly."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Notifications & Alerts/Notifications & Alerts — Master Book.md"
  ],
  "steps": [
    "Trace registry complete_task through useNotificationQuickAction and the actions route to current Schedule behavior.",
    "Use SCH-14 examples to show the extra tap versus full shortcut tradeoff with one recurring and one postponed occurrence.",
    "Record the owner's DEC-05 choice; do not silently remove the shortcut or guess which occurrence is meant.",
    "Then declare the exact registry/hook/route UI slice and implement delegation to Schedule, retaining stale/ambiguous refusal and Undo."
  ],
  "invariants": [
    "Done cannot silently complete a recurring series.",
    "A notification's display time alone is not original occurrence identity.",
    "Changing interaction density does not relax Schedule authorization or replay guarantees."
  ],
  "exclusions": [
    "Deciding the UX tradeoff for the owner, new expansion logic or treating notification action_completed as domain completion."
  ],
  "risks": [
    "The similarly named useCompleteNotificationAction only marks notification state; it is not proof the Schedule action ran."
  ],
  "unknowns": [
    "DEC-05 resolution and current SCH-14 parity/inverse readiness."
  ],
  "dependencies": [
    "SCH-14",
    "DEC-05"
  ],
  "risk": "high",
  "provenance": "2026-09-26: current registry quick-action callers use useNotificationQuickAction; useCompleteNotificationAction marks notification flags. Accepted DEC-05 hold retained.",
  "checks": [],
  "ownerReviewed": false
}
```

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
