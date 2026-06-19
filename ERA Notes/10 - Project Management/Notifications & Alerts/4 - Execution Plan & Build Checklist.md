---
created: 2026-06-19
updated: 2026-06-19
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/notifications
---

# Notifications & Alerts · 4 — Execution Plan & Build Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State & Pains](<1 - Feature State & Pain Inventory.md>) · [2 · Vision & Decisions](<2 - Vision, Target Design & Decisions.md>) · [3 · Best Practices & MoSCoW](<3 - Best Practices & MoSCoW Backlog.md>) · [4 · Execution & Checklist](<4 - Execution Plan & Build Checklist.md>)
>
> **What this file is:** the **single driving surface** — the call + sequenced Now/Next/Later queue, the candidate-work table (every pain + MoSCoW item as a work item), and the **Master Build Checklist** (phased, checkable bullets with IDs, severity, effort, and source links). **Tell me a line (e.g. _1.2_), a group (_Phase 1_), or a phase, and I'll work it.**
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. ✅ items are **done**; they stay as the record (Hard Rule #25 — no orphan fixes).
>
> **Status: nothing built yet** (docs created 2026-06-19). This is the queue, not a record of work.
>
> **Decisions already locked** (don't re-litigate — [file 2](<2 - Vision, Target Design & Decisions.md>)): bell is ambient (finite + reduced-motion); items summary → `/reminders`, budget reminder → `/expense` unchanged; drawer = fast lane (one-line rows + icon actions); alerts page = detailed-but-skimmable (cards + grouping + filters); strip `console.*` on touch.

---

## 📌 The call

**The pain is mapped ([file 1](<1 - Feature State & Pain Inventory.md>)). The directions are set ([file 2](<2 - Vision, Target Design & Decisions.md>)). The principles + MoSCoW are ordered ([file 3](<3 - Best Practices & MoSCoW Backlog.md>)). Now execute, blocker-first.**

The one true 🔴 is the **mis-routed daily items summary** — fix that first; it's small and high-impact. Then the three friction items the user named (calm bell, concise drawer, scannable alerts page), then hygiene + the Should backlog. This mirrors "fix what sends me to the wrong place, then calm what shouts, then declutter."

> **Reminder:** all four user asks (bell, routing, drawer, alerts page) are **Must**. Phases 1–4 below are exactly those four. Phase 5 is the Should/Could backlog.

---

## 🎯 Candidate work

### Campaign work items *(every pain from [file 1](<1 - Feature State & Pain Inventory.md>) + MoSCoW from [file 3](<3 - Best Practices & MoSCoW Backlog.md>))*

| # | Work item | From | MoSCoW | Sev | Effort | Bounded? |
|---|---|---|---|---|---|---|
| W1 | Route the daily items summary → `/reminders` (dedicated type or honor `action_url`) | C2 | M1 | 🔴 | S–M | ✅ yes |
| W2 | Calm the bell — finite animation + reduced-motion + calmer color | C1 | M2 | 🟠 | M | ✅ yes |
| W3 | Concise drawer rows + icon/compact actions | C3 | M3 | 🟠 | M | ✅ yes |
| W4 | Scannable alerts-page redesign | C4 | M4 | 🟠 | M–H | partly |
| W5 | Group notifications by `group_key`/type | C3/C5 | S1 | 🟡 | M | partly |
| W6 | Alerts-page filter segments | C4 | S2 | 🟡 | S–M | ✅ yes |
| W7 | Empty / "all caught up" states | C3/C4 | S3 | 🟡 | S | ✅ yes |
| W8 | Strip `console.*` from notification crons | C5 | S4 | 🟠 | S | ✅ yes |
| W9 | Unify drawer ↔ alerts-page visual language | C4 | S5 | 🟡 | M | partly |
| W10 | Audit Undo on dismiss/snooze (Hard Rule #1) | C5 | S6 | 🟡 | S | ✅ yes |
| W11 | Quiet hours / DND + per-type mute in Preferences | C5 | C-1 | 🟡 | M–H | partly |
| W12 | Bulk actions (snooze-all, clear-category) | C5 | C-2 | 🟡 | M | partly |

---

## 🗓️ Sequenced plan (Now / Next / Later)

### ▶️ Now — Fix the wrong-destination tap (W1, 🔴)

- [ ] **Decide Option A vs B** ([file 2 Decision 2](<2 - Vision, Target Design & Decisions.md>)): dedicated `daily_items_summary` type (preferred) vs honor `action_url` for `source:"system"`.
- [ ] **Implement + verify** the summary opens `/reminders` from both push (`sw.js`) and in-app (`getActionRoute`).

### ⏭️ Next — The three named UX asks (W2–W4, 🟠)

- [ ] **Calm bell** (W2) — finite-on-arrival animation, reduced-motion, calmer color.
- [ ] **Concise drawer** (W3) — one-line rows + icon/compact actions, Undo kept.
- [ ] **Scannable alerts page** (W4) — card hierarchy + tighter copy.

### 🔜 Later — Backlog (Should → Could)

- [ ] Grouping (W5), filter segments (W6), empty states (W7), `console.*` cleanup (W8), unify visual language (W9), Undo audit (W10).
- [ ] Quiet hours/DND (W11), bulk actions (W12), weekly digest, severity-aware bell color.

---

## 🏗️ Master Build Checklist *(the flattened, checkable surface)*

> Every pending item, phased. ✅ items are kept as the record. Point at a line, a group, or a phase.

### Phase 1 — Routing fix 🔴 _(W1 / M1 — the one blocker)_

- [ ] **1.1** Decide Option A (new `daily_items_summary` type) vs Option B (honor `action_url` for `source:"system"`). _(S)_
- [ ] **1.2** Update the cron: change `daily-items-reminder` to the new type (Option A) or fix `action_url` from `/items` → `/reminders` (Option B). → [daily-items-reminder/route.ts](<../../../src/app/api/cron/daily-items-reminder/route.ts>) _(S)_
- [ ] **1.3** Update in-app routing: add the case to `getActionRoute()` (`→ /reminders`) or make it consult `action_url` first for system notifications. → [useNotifications.ts](<../../../src/hooks/useNotifications.ts>) _(S)_
- [ ] **1.4** Update push routing: add the case to the `notificationclick` switch in [public/sw.js](<../../../public/sw.js>) (and confirm `DeepLinkHandler` handles a `/reminders` hard-nav — it's a standalone route, not a tab). → [sw.js](<../../../public/sw.js>), [DeepLinkHandler.tsx](<../../../src/components/DeepLinkHandler.tsx>) _(S)_
- [ ] **1.5** If Option A: add the enum value to the TS `NotificationType` union + any Zod schema; confirm `migrations/schema.sql` reflects it (DB change → migration file first, Hard Rule #24). _(S)_
- [ ] **1.6** Verify end-to-end: tapping the summary (push + in-app) lands on `/reminders`; the budget reminder still opens the expense form. _(S)_

### Phase 2 — Calm bell 🟠 _(W2 / M2)_

- [ ] **2.1** Replace the `1s infinite` ring with a **finite** on-arrival animation (play once on new, then rest); drop the always-on `.animate-notification-pulse` while merely unread. → [NotificationBell.tsx](<../../../src/components/notifications/NotificationBell.tsx>), [globals.css](<../../../src/app/globals.css>) _(M)_
- [ ] **2.2** Recolor the badge toward a calmer accent (theme/severity-aware); reserve red for urgent severities. Keep the count legible (`99+`). _(S)_
- [ ] **2.3** Add a `prefers-reduced-motion` path → static dot/count, no animation. _(S)_
- [ ] **2.4** Keep an explicit, accessible "N unread" + a calm "all caught up" rest state. _(S)_
- [ ] **2.5** Verify on a mobile viewport under each theme (Hard Rule #5). _(S)_

### Phase 3 — Concise drawer 🟠 _(W3 / M3)_

- [ ] **3.1** Collapse rows to one tier: **icon + title + short context + relative time**; remove/relocate the 2-line message (full text lives on the alerts page). → [NotificationModal.tsx](<../../../src/components/notifications/NotificationModal.tsx>) _(M)_
- [ ] **3.2** Convert quick actions to **icon-only/compact** controls with `aria-label`/tooltip; one primary inline, secondary in an overflow. → `getQuickActions()` in [useNotifications.ts](<../../../src/hooks/useNotifications.ts>) + render in `NotificationModal.tsx` _(M)_
- [ ] **3.3** Preserve **Undo** on destructive actions (Hard Rule #1) and use the `ToastIcons` enum. _(S)_
- [ ] **3.4** Floating-panel correctness: ensure the drawer/popover stays opaque per Hard Rule #15 (`tc.bgPage`, not glass) if any sub-panel floats. _(S)_
- [ ] **3.5** Verify on a mobile viewport. _(S)_

### Phase 4 — Scannable alerts page 🟠 _(W4 / M4)_

- [ ] **4.1** Card hierarchy: bold title → one-line context → time + a clear type icon; tighten copy throughout. → alerts render path in [HubPage.tsx](<../../../src/components/hub/HubPage.tsx>) (~5554–5737) _(M)_
- [ ] **4.2** Severity via **restrained accents** — confirm individual rows don't use red (Hard Rule #3); only container headers may. _(S)_
- [ ] **4.3** Keep the action-first transaction-reminder card but tighten its text + button copy. _(M)_
- [ ] **4.4** Verify on a mobile viewport; confirm `/alerts` top padding clears the fixed header (Hard Rule #16). _(S)_

### Phase 5 — Backlog (Should → Could) 🟡

- [ ] **5.1** Group notifications by `group_key`/type in drawer + page (collapse "N reminders", expand on tap). _(M · W5/S1)_
- [ ] **5.2** Filter segments on the alerts page (All / Budget / Reminders / Household). _(S–M · W6/S2)_
- [ ] **5.3** Empty / "all caught up" states for drawer + page. _(S · W7/S3)_
- [ ] **5.4** Strip `console.*` from the notification crons (Hard Rule #22). → [daily-items-reminder/route.ts](<../../../src/app/api/cron/daily-items-reminder/route.ts>), [daily-reminder/route.ts](<../../../src/app/api/cron/daily-reminder/route.ts>), [item-reminders/route.ts](<../../../src/app/api/cron/item-reminders/route.ts>) _(S · W8/S4)_
- [ ] **5.5** Unify drawer ↔ alerts-page icon vocabulary + severity treatment. _(M · W9/S5)_
- [ ] **5.6** Audit Undo on dismiss/snooze across both surfaces (Hard Rule #1). _(S · W10/S6)_
- [ ] **5.7** Quiet hours / DND + per-type mute in Preferences. _(M–H · W11/C-1)_
- [ ] **5.8** Bulk actions: snooze-all, clear-category. _(M · W12/C-2)_

---

## ✅ Definition of done — by phase

- [ ] **Phase 1:** tapping the daily items summary (push **and** in-app) lands on `/reminders`; the budget reminder still opens the expense form; `/items` no longer referenced; [file 1 Cluster 2](<1 - Feature State & Pain Inventory.md>) marked resolved.
- [ ] **Phase 2:** the bell no longer animates perpetually (finite-on-arrival only), respects `prefers-reduced-motion`, and the unread signal is calm but unambiguous.
- [ ] **Phase 3:** drawer rows are one tier with icon/compact actions; Undo intact; verified on mobile.
- [ ] **Phase 4:** the alerts page reads as scannable cards with clear hierarchy; no red on individual rows; verified on mobile.
- [ ] **Phase 5:** Should items shipped; Could items triaged.

---

## 🚫 Not now / Parked ⚪

- ⚪ **Standalone notification-center route** — `/alerts` + drawer already cover it (file 3 W-1).
- ⚪ **Cross-device read-state sync indicators** (file 3 W-2).
- ⚪ **ML/AI priority ranking** — revisit after types + grouping are clean (file 3 W-3).
- ⛔ **Geofenced/location-fired alerts** — decided no-geofencing at the app level (file 3 W-4).

---

## How to drive this

- Point at a **line** ("do 1.2"), a **group** ("Phase 1 routing"), or a **phase** ("start Phase 2").
- **Phase 1 is the blocker — do it first.** Phases 2–4 are the three named UX asks; Phase 5 is the backlog.
- As items complete, they get checked here **and** marked in [file 1](<1 - Feature State & Pain Inventory.md>) (Hard Rule #25 — no orphan fixes), with an `*(IMPLEMENTED YYYY-MM-DD)*` note in [file 2](<2 - Vision, Target Design & Decisions.md>) where a decision is realized.
- Any DB change (e.g., a new `notification_type`) needs a migration file first, then `schema.sql` (Hard Rule #24).

## Implemented fixes log

- [x] **2026-06-19 — Drawer open animation:** removed the `contentReady` / `onAnimationComplete` entrance gate from `NotificationModal.tsx`, so opening is one drawer slide and cached content renders immediately.
