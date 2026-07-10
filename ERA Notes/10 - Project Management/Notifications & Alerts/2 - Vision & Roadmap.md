---
created: 2026-06-19
updated: 2026-06-20
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/notifications
---

# Notifications & Alerts · 2 — Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** where each pain in [1 · Feature State](<1 - Feature State.md>) is *heading* — the target design per surface and the calls already locked — plus the **best-practice rationale** behind those designs and the **MoSCoW** backlog that orders the work. [File 1](<1 - Feature State.md>) is the sober reality; [3 · Action Plan](<3 - Action Plan.md>) + [4 · Checklist](<4 - Checklist.md>) hold the sequencing.
>
> **Decision legend:** ✅ **Committed** (decided, just needs building) · ❓ **Open** (trade-offs captured, choose in [3 · Action Plan](<3 - Action Plan.md>)) · 💭 **Direction** (shape agreed, details later).

---

## The strategic thesis

Notifications have one job: **say the right thing, calmly, and take me to the right place when I act.** Today the system is technically complete (unified table, push + in-app, dedup keys) but the *experience* leans the wrong way — it shouts (bell), mis-routes (items summary), and over-explains (drawer + alerts page).

**The vision in one line:** *A calm, glanceable notification layer — a quiet "you have something" signal, a fast drawer to triage, and a scannable alerts page to dig in — where every tap lands on the tool that resolves it.*

The guiding split, reaffirmed from CLAUDE.md's interaction model:

- **Bell** = ambient presence. Calm, not alarming.
- **Drawer** = the fast lane. Glanceable rows, one-tap actions, triage.
- **Alerts page** = the detailed lane. Descriptive but skimmable, grouped, filterable.

---

## Target design by cluster

### Cluster 1 — A calm bell *(replaces the perpetual alarm)*

💭 **Direction:** the bell should signal presence, not demand attention.

- Replace the **1s-infinite** ring with a **finite** cue: a single short animation when a *new* notification arrives, then rest. No perpetual wobble while merely unread.
- Soften the unread signal: keep a clear count, but move away from pure error-red toward a calmer accent (theme/severity-aware), reserving red/amber for genuinely urgent severities.
- Add a `prefers-reduced-motion` path that drops the animation to a static dot/count.
- Keep an unambiguous, accessible "you have N unread" state and an equally clear "all caught up" rest state.

> ✅ **Decision 1 — Bell is ambient, not an alarm.** Finite-on-arrival animation + reduced-motion support + calmer color; the unread *count* stays, the perpetual motion goes.

### Cluster 2 — Route the daily items summary to `/reminders`

✅ **Committed** (chosen 2026-06-19): the daily items summary opens the **standalone Reminders page** (`/reminders`), the parallel of "budget reminder → expense form."

Two viable implementations (decide in [3 · Action Plan](<3 - Action Plan.md>) Phase 1):

- **Option A (preferred) — a dedicated type.** Introduce `daily_items_summary` and add it to `getActionRoute()` (`→ /reminders`) and to the `sw.js` `notificationclick` switch. Cleanest: it also unblocks per-type theming/filtering later.
- **Option B — honor `action_url` for system notifications.** Make both routers consult `action_url` first when `source === "system"`, and fix the cron's `action_url` from the dead `/items` to `/reminders`.

> ✅ **Decision 2 — Items summary → `/reminders`; budget reminder → `/expense` unchanged.** Prefer the dedicated `daily_items_summary` type (Option A) so the two system notifications are independently routable/themeable. Either way, the dead `/items` `action_url` is corrected to `/reminders`.

### Cluster 3 — A glanceable drawer

💭 **Direction:** every row answers "what + when" at a glance; actions don't crowd the content.

- Collapse each row to a single information tier: **icon + title + short context + relative time**. Demote or drop the 2-line message in the drawer (full text lives on the alerts page).
- Convert quick actions to **icon-only / compact** controls with accessible labels (tooltip/`aria-label`); keep one primary action inline and move secondary actions to an overflow.
- Group related notifications by `group_key`/type (e.g., "3 reminders") with expand-on-tap.
- A concise, on-brand **empty state** that reinforces "all caught up."
- Preserve **Undo** on destructive actions (Hard Rule #1).

> ✅ **Decision 3 — Drawer is the fast lane.** One-line rows + icon/compact actions + grouping; full prose moves to the alerts page.

### Cluster 4 — A scannable alerts page

💭 **Direction:** descriptive but skimmable — the detailed lane, not a wall of words.

- Card layout with a strong hierarchy: **bold title → one-line context → time**, a clear type icon, and severity expressed through restrained accents (respect Hard Rule #3 — no red on individual rows; container headers may use red/amber).
- **Group by type/day** and add lightweight **filter segments** (e.g., All / Budget / Reminders / Household).
- Unify the visual language with the drawer so one notification reads consistently across both surfaces.
- Keep the rich, action-first transaction-reminder card, but tighten its copy.

> ✅ **Decision 4 — Alerts page is the detailed-but-skimmable lane.** Card hierarchy + grouping + filters, sharing one design language with the drawer. *(IMPLEMENTED 2026-07-10 — unified onto the bell's data source, realtime, date-grouped + `group_key`-deduped, filter chips, shared icon vocabulary via the registry. The filter taxonomy that shipped is System/Scheduled/Unread, not the originally-sketched Budget/Reminders/Household — the user found per-type filters confusing and defined a simpler two-type split instead; see the new taxonomy decision below.)*

### Cluster 5 — Hygiene & system polish

- ✅ **Decision 5 — Strip `console.*` from the notification crons** as part of any touch (Hard Rule #22).
- 💭 **Direction — Quiet hours / DND + per-type mute** surfaced in Preferences (Could-tier; see the MoSCoW backlog below).
- 💭 **Direction — Bulk actions** (snooze-all, clear-category) once grouping exists.

### Cluster 6 — Alert taxonomy, reliability backup, and full-screen catch-all *(added 2026-07-10)*

User contract (2026-07-10): notifications are missed/delayed/messy; wants (a) a two-type taxonomy so filtering and future automatic type-handling stay simple, (b) a Google Calendar backup channel for reliable timing even if `cronjob.com` is delayed or the device is offline, (c) a full-screen view guaranteed to catch attention on app open.

> ✅ **Decision 6 — Two-type taxonomy: System alerts vs Scheduled notifications.** System = app-generated prompts (log-transaction nudges, overdue summaries, budget/bill/goal alerts, chat, future proactive alerts) — never syncs to Google Calendar. Scheduled = fired from a user-created Reminder/Event (`item_reminder`/`item_due`/`item_overdue`) — the only class eligible for the calendar sync. Encoded as `NotificationClass` in the new registry (`src/lib/notifications/registry.tsx`), not as a DB column — derived per-type. **This is the alerts-page filter taxonomy, superseding the Budget/Reminders/Household sketch in Decision 4/S2.**

> ✅ **Decision 7 — Google Calendar API, one-way, parallel to the existing system.** App → Google only; Google is never read back (no 2-way sync — this is also the M1 scope fence elsewhere in the vault, but that note assumed an ICS feed; the user explicitly chose the **Calendar API over ICS** here because Google only refreshes ICS subscriptions every 8–24h, which fails the "accurate even if delayed/offline" goal a live API push+native-alarm gives). System alerts never sync — see Decision 6. *(IMPLEMENTED 2026-07-10 — code-complete, not live-tested; needs `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI`.)*

> ✅ **Decision 8 — Full-screen critical-alert takeover as a third "catch my attention" layer**, alongside push (`requireInteraction`) and Google Calendar's native alarms. Only for `takeoverEligible` types (registry-defined: `item_due`, `item_overdue`, `bill_overdue`, `budget_exceeded`) at high/urgent priority. Session-scoped "Later" dismissal, not permanent. *(IMPLEMENTED 2026-07-10 — `CriticalAlertGate.tsx`.)*

---

## Locked decisions (don't re-litigate)

| # | Decision | Status |
|---|---|---|
| 1 | Bell is ambient: finite-on-arrival animation, reduced-motion support, calmer color; keep the unread count. | ✅ Committed |
| 2 | Daily items summary → `/reminders`; budget reminder → `/expense` unchanged. Prefer a dedicated `daily_items_summary` type; correct the dead `/items` `action_url`. | ✅ Committed |
| 3 | Drawer = fast lane: one-line rows, icon/compact actions, grouping, Undo preserved. | ✅ Committed |
| 4 | Alerts page = detailed-but-skimmable: card hierarchy, grouping, filter segments, shared visual language. | ✅ Committed |
| 5 | Remove `console.*` from notification crons on touch. | ✅ Committed |
| — | Option A vs B for the routing fix (dedicated type vs honor `action_url`). | ❓ Open → decide in [3 · Action Plan](<3 - Action Plan.md>) Phase 1 |
| — | Quiet hours / DND + per-type mute scope. | 💭 Direction |

---

## Best-practice brief

> The *why* behind the target design — industry notification UX + this app's Hard Rules. The campaign is measured against these.

1. **Calm by default.** A notification surface should inform, not alarm. Continuous motion and error-red for ordinary counts raise baseline anxiety and train users to ignore the signal. Reserve red/amber for genuine urgency; animate **on change**, then rest.
2. **Glanceability over completeness — in the right place.** The drawer is for triage: "what + when" at a glance, one-tap actions. Long prose belongs on the detailed alerts page, not in the drawer. *One job per surface.*
3. **Actionable, not just informative.** Every notification should offer the next step inline (complete, snooze, open) — and the action should be reversible (Undo, Hard Rule #1).
4. **Land on the resolving tool.** A click must deep-link to the exact place that resolves it (the reminder → reminders; the spend prompt → expense form). Wrong-destination taps are the most damaging failure.
5. **Group to reduce volume.** Collapse related notifications (by `group_key`/type) so five reminders don't become five rows. Volume is the enemy of attention.
6. **Respect the user's attention budget.** Quiet hours / Do-Not-Disturb, per-type mute, and digests instead of a stream of singletons.
7. **Accessibility is not optional.** Honor `prefers-reduced-motion`; give icon-only controls accessible labels; ensure color is not the *only* carrier of meaning.
8. **One visual language.** The same notification should read consistently in the drawer and on the alerts page — same icon vocabulary, same severity treatment.
9. **Scannable hierarchy.** Bold title → one-line context → time; type icon; restrained severity accent. Skimmable beats dense even on the "detailed" surface.
10. **Clear empty states.** "All caught up" should feel like a reward, reinforcing the calm baseline.

---

## MoSCoW backlog

> Scope mapped onto Must / Should / Could / Won't-now. Each item links to its pain in [1 · Feature State](<1 - Feature State.md>); the target design is above. Sequencing is in [3 · Action Plan](<3 - Action Plan.md>) + [4 · Checklist](<4 - Checklist.md>).

### 🔴 Must *(the user's four asks + the one hard bug)*

| # | Item | Pain | Principle |
|---|---|---|---|
| M1 | **Fix the daily items summary routing → `/reminders`** (dedicated `daily_items_summary` type *or* honor `action_url` for system notifications; correct the dead `/items`). | [C2](<1 - Feature State.md>) 🔴 | #4 Land on the resolving tool |
| M2 | **Calm the bell** — finite-on-arrival animation (no perpetual ring), calmer color, `prefers-reduced-motion`, keep a clear unread count. | [C1](<1 - Feature State.md>) 🟠 | #1 Calm, #7 Accessibility |
| M3 | **Concise drawer rows** — one information tier (icon + title + short context + time) + **icon-only/compact** actions with accessible labels; keep Undo. | [C3](<1 - Feature State.md>) 🟠 | #2 Glanceable, #3 Actionable |
| M4 | **Scannable alerts page** — card hierarchy (title → one-line context → time), type icons, restrained severity accents (Hard Rule #3), tighter copy. | [C4](<1 - Feature State.md>) 🟠 | #9 Scannable hierarchy |

### 🟠 Should *(clearly worth doing in this campaign)*

| # | Item | Pain | Principle |
|---|---|---|---|
| S1 | **Group notifications** by `group_key`/type. ✅ IMPLEMENTED 2026-07-10 on the alerts page (drawer still ungrouped). | [C3](<1 - Feature State.md>)/[C5](<1 - Feature State.md>) | #5 Group to reduce volume |
| S2 | **Filter segments** on the alerts page. ✅ IMPLEMENTED 2026-07-10 as All/System/Scheduled/Unread (Decision 6). | [C4](<1 - Feature State.md>) | #2 One job per surface |
| S3 | **Empty / "all caught up" states** for drawer + page. | [C3](<1 - Feature State.md>)/[C4](<1 - Feature State.md>) | #10 Clear empty states |
| S4 | **Strip `console.*`** from the notification crons (Hard Rule #22). Still open — 2026-07-10 stripped it from `/api/notifications/in-app` and `/api/notifications/actions` instead. | [C5](<1 - Feature State.md>) | hygiene |
| S5 | **Unify the visual language** across drawer + alerts page. ✅ IMPLEMENTED 2026-07-10 via the shared registry icon renderer. | [C4](<1 - Feature State.md>) | #8 One visual language |
| S6 | **Audit Undo on dismiss/snooze** (Hard Rule #1) across both surfaces. | [C5](<1 - Feature State.md>) | #3 Reversible |

### 🟡 Could *(nice, after the core)*

| # | Item | Pain | Principle |
|---|---|---|---|
| C-1 | **Quiet hours / DND + per-type mute** surfaced in Preferences. | [C5](<1 - Feature State.md>) | #6 Attention budget |
| C-2 | **Bulk actions** beyond mark-all-read (snooze-all, clear-category). | [C5](<1 - Feature State.md>) | #5 Reduce volume |
| C-3 | **Weekly digest** option instead of daily singletons. | bridge | #6 Attention budget |
| C-4 | **Severity-aware bell color** (calm accent → amber → red only when urgent). | [C1](<1 - Feature State.md>) | #1 Calm |
| C-5 | **Coherent expiry/retention policy** across all notification types. | [C5](<1 - Feature State.md>) | hygiene |

### ⚪ Won't *(this campaign)*

| # | Item | Why |
|---|---|---|
| W-1 | Standalone notification-center route separate from `/alerts`. | `/alerts` + drawer already cover it; adding a third surface fights "one job per surface." |
| W-2 | Cross-device read-state sync indicators. | Out of scope; the `notifications` table is already the shared source. |
| W-3 | ML/AI-based priority ranking of notifications. | Premature; revisit once grouping + types are clean. |
| W-4 | Geofenced/location-fired alerts. | Decided no-geofencing at the app level (see Schedule). |

---

## Bridges out *(cross-module, later)*

- **Notifications ↔ Schedule (smart timing).** Alerts fire at fixed offsets today; smart timing + quiet hours + a weekly digest instead of daily noise. *(ladders to the global weekly-digest line)*
- **Notifications ↔ Budget.** Spending alerts already exist; align their routing + tone with this calmer design.
- **Notifications ↔ Hub.** The alerts feed lives in `HubPage`; the redesign should keep the feed and alerts tabs coherent.

→ What to build, and in what order → [3 · Action Plan](<3 - Action Plan.md>); the checkable list → [4 · Checklist](<4 - Checklist.md>).

## Implemented decisions log

- ✅ **Drawer open animation — IMPLEMENTED 2026-06-19:** `NotificationModal.tsx` no longer delays cached drawer content until `onAnimationComplete`. The drawer keeps one Framer slide-in motion; skeleton rows are reserved for actual `isLoading` states.
- ✅ **Notification Registry, alerts-page unification, critical-alert gate, Google Calendar sync — IMPLEMENTED 2026-07-10:** Decisions 4 (partial), 6, 7, 8. Full detail in [FABLED 2 index](<FABLED 2/_index.md>) delta section and the [Notifications module doc](<../../03 - Junction Modules/Notifications/Notifications.md>).
