---
created: 2026-06-19
updated: 2026-07-15
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
> **What this file is:** the single flat, checkable surface for Notifications & Alerts — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why + order* is [3 · Action Plan](<3 - Action Plan.md>). Completed items are cleared once done — see git history or [1 · Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** old phase IDs `1.x/2.x/3.x/4.x/5.x/6.6` → `NOTIF-1.x/…/NOTIF-6.6`; phases map to lanes (Phase 1 → Now; Phases 2–3 + 6.6 → Next; Phases 4–5 → Later).

---

## Now

**Phase 1 — Routing fix** *(the one blocker; W1 / M1)*

- [ ] **NOTIF-1.1** Decide Option A (new `daily_items_summary` type) vs Option B (honor `action_url` for `source:"system"`). _(blocker - S)_
- [ ] **NOTIF-1.2** Update the cron: change `daily-items-reminder` to the new type (Option A) or fix `action_url` from `/items` → `/reminders` (Option B). → `src/app/api/cron/daily-items-reminder/route.ts` _(blocker - S)_
- [ ] **NOTIF-1.3** Update in-app routing: add the case to `getActionRoute()` (`→ /reminders`) or make it consult `action_url` first for system notifications. → `src/hooks/useNotifications.ts` _(blocker - S)_
- [ ] **NOTIF-1.4** Update push routing: add the case to the `notificationclick` switch in `public/sw.js` (and confirm `DeepLinkHandler` handles a `/reminders` hard-nav — it's a standalone route, not a tab). → `public/sw.js`, `src/components/DeepLinkHandler.tsx` _(blocker - S)_
- [ ] **NOTIF-1.5** If Option A: add the enum value to the TS `NotificationType` union + any Zod schema; confirm `migrations/schema.sql` reflects it (DB change → migration file first, Hard Rule #24). _(blocker - S)_
- [ ] **NOTIF-1.6** Verify end-to-end: tapping the summary (push + in-app) lands on `/reminders`; the budget reminder still opens the expense form. _(blocker - S)_

## Next

**Phase 2 — Calm bell** *(W2 / M2)*

- [ ] **NOTIF-2.1** Replace the `1s infinite` ring with a **finite** on-arrival animation (play once on new, then rest); drop the always-on `.animate-notification-pulse` while merely unread. → `src/components/notifications/NotificationBell.tsx`, `src/app/globals.css` _(friction - M)_
- [ ] **NOTIF-2.2** Recolor the badge toward a calmer accent (theme/severity-aware); reserve red for urgent severities. Keep the count legible (`99+`). _(friction - S)_
- [ ] **NOTIF-2.3** Add a `prefers-reduced-motion` path → static dot/count, no animation. _(friction - S)_
- [ ] **NOTIF-2.4** Keep an explicit, accessible "N unread" + a calm "all caught up" rest state. _(friction - S)_
- [ ] **NOTIF-2.5** Verify on a mobile viewport under each theme (Hard Rule #5). _(friction - S)_

**Phase 3 — Concise drawer** *(W3 / M3)*

- [ ] **NOTIF-3.1** Collapse rows to one tier: **icon + title + short context + relative time**; remove/relocate the 2-line message (full text lives on the alerts page). → `src/components/notifications/NotificationModal.tsx` _(friction - M)_
- [ ] **NOTIF-3.2** Convert quick actions to **icon-only/compact** controls with `aria-label`/tooltip; one primary inline, secondary in an overflow. → `src/hooks/useNotifications.ts`, `src/components/notifications/NotificationModal.tsx` _(friction - M)_
- [ ] **NOTIF-3.3** Preserve **Undo** on destructive actions (Hard Rule #1) and use the `ToastIcons` enum. _(friction - S)_
- [ ] **NOTIF-3.4** Floating-panel correctness: ensure the drawer/popover stays opaque per Hard Rule #15 (`tc.bgPage`, not glass) if any sub-panel floats. _(friction - S)_
- [ ] **NOTIF-3.5** Verify on a mobile viewport. _(friction - S)_

**Phase 6 — Calendar backup** *(shipped 2026-07-10; one live-verify left)*

> User contract: notifications felt weak/missed; asked for a full-screen catch-all view, a Google Calendar backup (one-way, parallel to the existing system), a System-vs-Scheduled alert taxonomy, and a scalable per-type action contract.

- [ ] **NOTIF-6.6** Live-verify Google Calendar sync end-to-end once credentials are set (connect → event appears → native alarm fires → reconcile heals drift). **Blocked on credentials.** Still open: native alarm fires on the phone; reconcile cron heals drift (cron needs an external scheduler — never assume it's live). _(friction - M)_

## Later

**Phase 4 — Scannable alerts page** *(W4 / M4)*

- [ ] **NOTIF-4.1** Card hierarchy: bold title → one-line context → time + a clear type icon; tighten copy throughout. → `src/components/hub/HubPage.tsx` (~5554–5737) _(friction - M)_
- [ ] **NOTIF-4.2** Severity via **restrained accents** — confirm individual rows don't use red (Hard Rule #3); only container headers may. _(friction - S)_
- [ ] **NOTIF-4.3** Keep the action-first transaction-reminder card but tighten its text + button copy. _(friction - M)_
- [ ] **NOTIF-4.4** Verify on a mobile viewport; confirm `/alerts` top padding clears the fixed header (Hard Rule #16). _(friction - S)_

**Phase 5 — Backlog (Should → Could)**

- [ ] **NOTIF-5.3** Empty / "all caught up" states for drawer + page (page's empty state preserved as-is, not redesigned). _(annoyance - S)_
- [ ] **NOTIF-5.4** Strip `console.*` from the notification crons (Hard Rule #22). → `src/app/api/cron/daily-items-reminder/route.ts`, `src/app/api/cron/daily-reminder/route.ts`, `src/app/api/cron/item-reminders/route.ts`. Still open; on 2026-07-10 `console.*` was instead stripped from `/api/notifications/in-app` and `/api/notifications/actions`. _(annoyance - S)_
- [ ] **NOTIF-5.6** Audit Undo on dismiss/snooze across both surfaces (Hard Rule #1). Still open on the drawer/alerts page (silent optimistic mutations, no toast); the new Critical Alert Gate does have Undo. _(annoyance - S)_
- [ ] **NOTIF-5.7** Quiet hours / DND + per-type mute in Preferences. _(annoyance - L)_
- [ ] **NOTIF-5.8** Bulk actions: snooze-all, clear-category. _(annoyance - M)_

## Definition of Done

- [ ] **D1** *(Phase 1)* Tapping the daily items summary (push **and** in-app) lands on `/reminders`; the budget reminder still opens the expense form; `/items` no longer referenced; [1 · Feature State](<1 - Feature State.md>) Cluster 2 marked resolved.
- [ ] **D2** *(Phase 2)* The bell no longer animates perpetually (finite-on-arrival only), respects `prefers-reduced-motion`, and the unread signal is calm but unambiguous.
- [ ] **D3** *(Phase 3)* Drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.
- [ ] **D4** *(Phase 4)* The alerts page reads as scannable cards with clear hierarchy; no red on individual rows; verified on mobile.
- [ ] **D5** *(Phase 5)* Should items shipped; Could items triaged.
