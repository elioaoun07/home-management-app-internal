---
created: 2026-06-19
updated: 2026-06-19
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/notifications
---

# Notifications & Alerts · 2 — Vision, Target Design & Decisions

> **Command Center:** [_index](<_index.md>) · [1 · Feature State & Pains](<1 - Feature State & Pain Inventory.md>) · [2 · Vision & Decisions](<2 - Vision, Target Design & Decisions.md>) · [3 · Best Practices & MoSCoW](<3 - Best Practices & MoSCoW Backlog.md>) · [4 · Execution & Checklist](<4 - Execution Plan & Build Checklist.md>)
>
> **What this file is:** where each pain in [file 1](<1 - Feature State & Pain Inventory.md>) is *heading* — the target design per surface plus the calls already locked. This file is allowed to dream; [file 1](<1 - Feature State & Pain Inventory.md>) is the sober reality, and [file 4](<4 - Execution Plan & Build Checklist.md>) holds the sequencing. The *why* behind these designs (best-practice rationale) lives in [file 3](<3 - Best Practices & MoSCoW Backlog.md>).
>
> **Decision legend:** ✅ **Committed** (decided, just needs building) · ❓ **Open** (trade-offs captured, choose in [file 4](<4 - Execution Plan & Build Checklist.md>)) · 💭 **Direction** (shape agreed, details later).

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

Two viable implementations (decide in [file 4](<4 - Execution Plan & Build Checklist.md>) Phase 1):

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

> ✅ **Decision 4 — Alerts page is the detailed-but-skimmable lane.** Card hierarchy + grouping + filters, sharing one design language with the drawer.

### Cluster 5 — Hygiene & system polish

- ✅ **Decision 5 — Strip `console.*` from the notification crons** as part of any touch (Hard Rule #22).
- 💭 **Direction — Quiet hours / DND + per-type mute** surfaced in Preferences (Could-tier; see [file 3](<3 - Best Practices & MoSCoW Backlog.md>)).
- 💭 **Direction — Bulk actions** (snooze-all, clear-category) once grouping exists.

---

## Locked decisions (don't re-litigate)

| # | Decision | Status |
|---|---|---|
| 1 | Bell is ambient: finite-on-arrival animation, reduced-motion support, calmer color; keep the unread count. | ✅ Committed |
| 2 | Daily items summary → `/reminders`; budget reminder → `/expense` unchanged. Prefer a dedicated `daily_items_summary` type; correct the dead `/items` `action_url`. | ✅ Committed |
| 3 | Drawer = fast lane: one-line rows, icon/compact actions, grouping, Undo preserved. | ✅ Committed |
| 4 | Alerts page = detailed-but-skimmable: card hierarchy, grouping, filter segments, shared visual language. | ✅ Committed |
| 5 | Remove `console.*` from notification crons on touch. | ✅ Committed |
| — | Option A vs B for the routing fix (dedicated type vs honor `action_url`). | ❓ Open → decide in [file 4](<4 - Execution Plan & Build Checklist.md>) Phase 1 |
| — | Quiet hours / DND + per-type mute scope. | 💭 Direction |

---

## Bridges out *(cross-module, later)*

- **Notifications ↔ Schedule (smart timing).** Alerts fire at fixed offsets today; smart timing + quiet hours + a weekly digest instead of daily noise. *(ladders to the global weekly-digest line)*
- **Notifications ↔ Budget.** Spending alerts already exist; align their routing + tone with this calmer design.
- **Notifications ↔ Hub.** The alerts feed lives in `HubPage`; the redesign should keep the feed and alerts tabs coherent.

→ The best-practice rationale + MoSCoW ordering → [3 · Best Practices & MoSCoW Backlog](<3 - Best Practices & MoSCoW Backlog.md>).
→ What to build, and in what order → [4 · Execution Plan & Build Checklist](<4 - Execution Plan & Build Checklist.md>).

## Implemented decisions log

- ✅ **Drawer open animation — IMPLEMENTED 2026-06-19:** `NotificationModal.tsx` no longer delays cached drawer content until `onAnimationComplete`. The drawer keeps one Framer slide-in motion; skeleton rows are reserved for actual `isLoading` states.
