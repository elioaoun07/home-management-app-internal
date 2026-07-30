---
created: 2026-06-19
updated: 2026-06-20
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/notifications
---

# Notifications & Alerts · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *why, and in what order* — the call + the sequenced Now/Next/Later queue + the candidate-work table. The flat, phased, checkable version (with IDs) is [4 · Checklist](<4 - Checklist.md>). **Tell me a line (e.g. _1.2_), a group (_Phase 1_), or a phase, and I'll work it.**
>
> **Status: nothing built yet** (docs created 2026-06-19). This is the queue, not a record of work.
>
> **Decisions already locked** (don't re-litigate — [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>)): bell is ambient (finite + reduced-motion); items summary → `/reminders`, budget reminder → `/expense` unchanged; drawer = fast lane (one-line rows + icon actions); alerts page = detailed-but-skimmable (cards + grouping + filters); strip `console.*` on touch.

---

## 📌 The call

**The pain is mapped ([1 · Feature State](<1 - Feature State.md>)). The directions + best practices + MoSCoW are set ([2 · Vision & Roadmap](<2 - Vision & Roadmap.md>)). Now execute, blocker-first.**

The one true 🔴 is the **mis-routed daily items summary** — fix that first; it's small and high-impact. Then the three friction items the user named (calm bell, concise drawer, scannable alerts page), then hygiene + the Should backlog. This mirrors "fix what sends me to the wrong place, then calm what shouts, then declutter."

> **Reminder:** all four user asks (bell, routing, drawer, alerts page) are **Must**. Phases 1–4 in [4 · Checklist](<4 - Checklist.md>) are exactly those four. Phase 5 is the Should/Could backlog.

---

## 🎯 Candidate work *(every pain from [1 · Feature State](<1 - Feature State.md>) + MoSCoW from [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>))*

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

**▶️ Now — Fix the wrong-destination tap (W1, 🔴).** Decide Option A vs B ([2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) Decision 2): dedicated `daily_items_summary` type (preferred) vs honor `action_url` for `source:"system"`. Then implement + verify the summary opens `/reminders` from both push (`sw.js`) and in-app (`getActionRoute`).

**⏭️ Next — The three named UX asks (W2–W4, 🟠).** Calm bell (finite-on-arrival, reduced-motion, calmer color); concise drawer (one-line rows + icon/compact actions, Undo kept); scannable alerts page (card hierarchy + tighter copy).

**🔜 Later — Backlog (Should → Could).** Grouping (W5), filter segments (W6), empty states (W7), `console.*` cleanup (W8), unify visual language (W9), Undo audit (W10); then quiet hours/DND (W11), bulk actions (W12), weekly digest, severity-aware bell color.

→ Every item phased, with IDs and acceptance criteria: [4 · Checklist](<4 - Checklist.md>).

---

## 🚫 Not now / Parked ⚪

- ⚪ **Standalone notification-center route** — `/alerts` + drawer already cover it ([2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) W-1).
- ⚪ **Cross-device read-state sync indicators** (W-2).
- ⚪ **ML/AI priority ranking** — revisit after types + grouping are clean (W-3).
- ⛔ **Geofenced/location-fired alerts** — decided no-geofencing at the app level (W-4).

---

## How to drive this

- Point at a **line** ("do 1.2"), a **group** ("Phase 1 routing"), or a **phase** ("start Phase 2") — the IDs live in [4 · Checklist](<4 - Checklist.md>).
- **Phase 1 is the blocker — do it first.** Phases 2–4 are the three named UX asks; Phase 5 is the backlog.
- As items complete, check them in [4 · Checklist](<4 - Checklist.md>) **and** mark the pain resolved in [1 · Feature State](<1 - Feature State.md>) (Hard Rule #25 — no orphan fixes), with an `*(IMPLEMENTED YYYY-MM-DD)*` note in [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) where a decision is realized.
- Any DB change (e.g., a new `notification_type`) needs a migration file first, then `schema.sql` (Hard Rule #24).
