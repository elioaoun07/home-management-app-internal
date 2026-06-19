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

# Notifications & Alerts · 3 — Best Practices & MoSCoW Backlog

> **Command Center:** [_index](<_index.md>) · [1 · Feature State & Pains](<1 - Feature State & Pain Inventory.md>) · [2 · Vision & Decisions](<2 - Vision, Target Design & Decisions.md>) · [3 · Best Practices & MoSCoW](<3 - Best Practices & MoSCoW Backlog.md>) · [4 · Execution & Checklist](<4 - Execution Plan & Build Checklist.md>)
>
> **What this file is:** the *why* behind the target design — a short brief of notification/alert UX best practices — followed by the **MoSCoW** backlog (Must / Should / Could / Won't) that orders the work. [File 2](<2 - Vision, Target Design & Decisions.md>) holds the design; [file 4](<4 - Execution Plan & Build Checklist.md>) holds the sequencing.

---

## Best-practice brief

The principles this campaign is measured against (industry notification UX + this app's Hard Rules):

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

> Scope mapped onto Must / Should / Could / Won't-now. Each item links to its pain in [file 1](<1 - Feature State & Pain Inventory.md>) and target in [file 2](<2 - Vision, Target Design & Decisions.md>). Sequencing is in [file 4](<4 - Execution Plan & Build Checklist.md>).

### 🔴 Must *(the user's four asks + the one hard bug)*

| # | Item | Pain | Principle |
|---|---|---|---|
| M1 | **Fix the daily items summary routing → `/reminders`** (dedicated `daily_items_summary` type *or* honor `action_url` for system notifications; correct the dead `/items`). | [C2](<1 - Feature State & Pain Inventory.md>) 🔴 | #4 Land on the resolving tool |
| M2 | **Calm the bell** — finite-on-arrival animation (no perpetual ring), calmer color, `prefers-reduced-motion`, keep a clear unread count. | [C1](<1 - Feature State & Pain Inventory.md>) 🟠 | #1 Calm, #7 Accessibility |
| M3 | **Concise drawer rows** — one information tier (icon + title + short context + time) + **icon-only/compact** actions with accessible labels; keep Undo. | [C3](<1 - Feature State & Pain Inventory.md>) 🟠 | #2 Glanceable, #3 Actionable |
| M4 | **Scannable alerts page** — card hierarchy (title → one-line context → time), type icons, restrained severity accents (Hard Rule #3), tighter copy. | [C4](<1 - Feature State & Pain Inventory.md>) 🟠 | #9 Scannable hierarchy |

### 🟠 Should *(clearly worth doing in this campaign)*

| # | Item | Pain | Principle |
|---|---|---|---|
| S1 | **Group notifications** by `group_key`/type in the drawer and page ("3 reminders", expand on tap). | [C3](<1 - Feature State & Pain Inventory.md>)/[C5](<1 - Feature State & Pain Inventory.md>) | #5 Group to reduce volume |
| S2 | **Filter segments** on the alerts page (All / Budget / Reminders / Household). | [C4](<1 - Feature State & Pain Inventory.md>) | #2 One job per surface |
| S3 | **Empty / "all caught up" states** for drawer + page. | [C3](<1 - Feature State & Pain Inventory.md>)/[C4](<1 - Feature State & Pain Inventory.md>) | #10 Clear empty states |
| S4 | **Strip `console.*`** from the notification crons (Hard Rule #22). | [C5](<1 - Feature State & Pain Inventory.md>) | hygiene |
| S5 | **Unify the visual language** across drawer + alerts page (one icon vocabulary + severity treatment). | [C4](<1 - Feature State & Pain Inventory.md>) | #8 One visual language |
| S6 | **Audit Undo on dismiss/snooze** (Hard Rule #1) across both surfaces. | [C5](<1 - Feature State & Pain Inventory.md>) | #3 Reversible |

### 🟡 Could *(nice, after the core)*

| # | Item | Pain | Principle |
|---|---|---|---|
| C-1 | **Quiet hours / DND + per-type mute** surfaced in Preferences. | [C5](<1 - Feature State & Pain Inventory.md>) | #6 Attention budget |
| C-2 | **Bulk actions** beyond mark-all-read (snooze-all, clear-category). | [C5](<1 - Feature State & Pain Inventory.md>) | #5 Reduce volume |
| C-3 | **Weekly digest** option instead of daily singletons. | bridge | #6 Attention budget |
| C-4 | **Severity-aware bell color** (calm accent → amber → red only when urgent). | [C1](<1 - Feature State & Pain Inventory.md>) | #1 Calm |
| C-5 | **Coherent expiry/retention policy** across all notification types. | [C5](<1 - Feature State & Pain Inventory.md>) | hygiene |

### ⚪ Won't *(this campaign)*

| # | Item | Why |
|---|---|---|
| W-1 | Standalone notification-center route separate from `/alerts`. | `/alerts` + drawer already cover it; adding a third surface fights "one job per surface." |
| W-2 | Cross-device read-state sync indicators. | Out of scope; the `notifications` table is already the shared source. |
| W-3 | ML/AI-based priority ranking of notifications. | Premature; revisit once grouping + types are clean. |
| W-4 | Geofenced/location-fired alerts. | Decided no-geofencing at the app level (see Schedule). |

→ Sequenced into phases → [4 · Execution Plan & Build Checklist](<4 - Execution Plan & Build Checklist.md>).
