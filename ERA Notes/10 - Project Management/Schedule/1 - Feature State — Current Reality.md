---
created: 2026-05-30
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/schedule
---

# Schedule · 1 — Feature State — Current Reality

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the *honest, no-hype* state of every Schedule sub-feature — what exists, how mature it is, and the single most useful next step. **No imagination here** (that's file 2).
>
> **Method & confidence:** a **structural** assessment derived from the module's vault docs ([Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>), [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>)), live route/API surface, and `src/features/items/`. It is **not** a line-by-line correctness audit. Treat tiers as "how battle-tested," not "bug-free."
>
> **Module identity:** "Schedule" is the user-facing name for the **Items & Reminders** standalone module. At the app level (global [2 · Feature State](<../2 - Feature State — Current Reality.md>)) it is **🟢 Core, stable** — `useItems.ts` is ~2,621 LOC and reads go through the `get_schedule_bundle` RPC pattern.

---

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, oldest, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled. |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
|---|---|---|---|
| **Fixed reminders / events** | 🟢 Core | One-shot `reminder_details.due_at` / `event_details.start_at`. The plain, daily path. Mobile quick + full forms, desktop dialog. | — (stable) |
| **RRULE recurring** | 🟢 Core | `item_recurrence_rules.rrule` expanded against `start_anchor` (the DTSTART). Wall-clock DST adjustment. Bi-weekly detect + phase-flip. Per-occurrence actions in `item_occurrence_actions`; exceptions in `item_recurrence_exceptions`. Expansion unit-tested ✅ (`lib/schedule/expandOccurrences.test.ts`, verified 2026-06-10); **occurrence-action logic still untested**. | Unit-test occurrence actions + exception/skip ([FABLED O1](<FABLED/3 - FABLED — Optimization Plan.md>)). |
| **Flexible routines** | 🔵 Established | "N times per period" with user-picked days (`item_flexible_schedules`). Universal placement rule: when `is_flexible`, **all views ignore the rrule** and inject schedule rows. Overdue look-back ≤3 periods. | Guard the placement rule with a test; it silently breaks new views. |
| **Subtasks** | 🔵 Established | Kanban, priority, nested. `ItemSubtasks.tsx` + toggle/add/delete/update hooks. | — (stable) |
| **Alerts** | 🔵 Established | `SmartAlertPicker` (absolute/relative, repeat, channels) → `item_alerts`; fired by the `item-reminders` cron. Soft-delete/archive must deactivate alerts; cancelled occurrences suppressed via `item_alert_suppressions`. | Watch for missed-suppression edge cases. |
| **Prerequisites** | 🟠 Stub/Partial | Trigger conditions (NFC tag / location / other item). Engine works for NFC→item unlock, but **4 evaluators are stubs**: `weather`, `time_window`, `schedule`, `custom_formula` (per global [2 · Feature State](<../2 - Feature State — Current Reality.md>)). | Ship `time_window` first (highest value, lowest effort). |
| **Calendar / Today / Week views** | 🔵 Established | Month/week/today across web + mobile, recurrence expansion, day-expansion modal. All must honor the universal placement rule (skip flexible in rrule loop, inject schedules). | No per-view regression test for the placement rule. |
| **Standalone `/reminders` page** | 🔵 Established | Four occurrence buckets — Overdue (-90d), Today, This Week (+1→+7d), Later (+7→+90d). "Later" keeps monthly items visible mid-period. mine/partner filter keys on `responsible_user_id`. | — (stable) |
| **Household assignment** | 🔵 Established | `responsible_user_id` — an item you own but assign to your partner shows under "partner". | — (stable) |
| **Focus insights (AI briefing)** | 🟡 New/Thin | `useFocusInsights` → AI-generated Focus briefing, cached 24h. Lives partly in the Focus module. | Enrich briefing with cross-module data (see file 2). |
| **Catalogue templates** | 🔵 Established | Items can be promoted to / created from catalogue templates (`source_catalogue_item_id`); flexible routines originate here. | — (stable) |
| **Plan My Day (disrupted-day planner)** | 🟡 New/Thin | Shipped 2026-06-16. Dedicated `/today` page — triage list of everything landing on a day (one-time + recurring + flexible via shared `dayOccurrences.ts` util), push-off, both-direction prepone for flexible items, ad-hoc tasks, checkpoints. Persisted via new `day_plans` table (title/intent/notes/checkpoints/is_public). **Fixed 2026-06-16:** the header + checkpoints used to auto-save an API call on every keystroke/click (worst case: a `POST` per Private/Shared toggle); now a save-gated draft model — edit form with one Save for an unplanned day, read-only preview card with Edit/Delete for a planned one. | Mood/energy "rest vs productivity" optimizer is deferred — `intent` is stored but unread by any optimizer yet. |

---

## Related code (single source of truth)

Do **not** duplicate file-path tables here — they drift. The authoritative code map lives in:

- [Items & Reminders / Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) — UI entry points, mutation hooks, occurrence-action hooks, API routes, module Hard Rules.
- [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) — the three placement strategies (fixed / recurring / flexible), the universal placement rule, the flexible lifecycle, and the "add a new view" checklist.

---

## The honest weak-link summary

_(Updated 2026-05-30)_

1. **The recurrence + occurrence-action math is untested.** Skip/postpone/complete at the occurrence level and RRULE expansion are the trickiest logic in the module and have no unit coverage. This is the highest-risk gap.
2. **The universal placement rule is enforced by convention, not by a test.** Every new date-surfacing view must `continue` on flexible items and inject schedule rows; forget it and flexible items land on the activation day. A single guard test would prevent the whole class of bug.
3. **Prerequisites is half-built** — 4 evaluators advertised but inert (`weather`, `time_window`, `schedule`, `custom_formula`).
4. **`useItems.ts` is ~2,621 LOC** — a change-risk hotspot. Don't refactor for its own sake; split when next touched.

→ The growth opportunities are in [2 · Future Vision](<2 - Future Vision & Roadmap.md>); the concrete next steps are in [3 · Current Action Plan](<3 - Current — Action Plan.md>).
