---
created: 2026-07-02
type: index
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/schedule
---

# Schedule · FABLED 2 — Index

> Second-generation deep-dive, superseding [FABLED v1](<../FABLED/_index.md>) (2026-06-10). Re-verified against the working tree **2026-07-02** — tests run, engines traced, dead code re-checked. v1 stays as the frozen baseline; this folder is the living one. v1's links to the pre-uniformization campaign file names were already broken — everything here points at the current names.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You need the post-June X-ray: the three-engine situation, the new `/reminders` planner surface, what schema truth now lives in the repo. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the re-ranked list — including the red test suite nobody should learn to ignore. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You're touching the engine/actions layer and want the staged unification path. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You're planning beyond the recurrence campaign — including two ideas June's data made possible. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Household semantics** | 8 | Co-edit 403 fixed, pass/take-back shipped, all-household cron targeting fixed, occurrence actions idempotent on replay. The once-worst cluster is now the strongest. |
| **Engine correctness** | 5 | Skip-duplicates 🔴 fixed (Stage 1) — but **three expansion engines still diverge** and the tested one is wired to nothing. |
| **Test protection** | 5 | `expandOccurrences` + `dayOccurrences` + placement covered — but the source-regex guard test **fails on main**, turning the whole suite red. |
| **Capture UX** | 7 | Live form single-page with NL parse (`smartTextParser`, ~1,419 lines), quick chips, title-only save; Hub bulk-convert with draft review. |
| **Code health** | 4 | `useItems.ts` 2,637 LOC; dead `MobileItemForm.tsx` (1,363 lines) **still on disk after three flags**. |
| **Outward bridges** | 3 | No `getWeekShape()`; ERA still reads shallow slices; `day_plans.intent` captured but consumed by nothing. |
| **Overall** | **5.3** | Stage 1 proved the will; Stage 2 (one engine) is where the module either becomes trustworthy or stays haunted. |

## Delta since FABLED v1 — the headline

**Shipped:** Skip/postpone semantics fixed across 4 surfaces (2026-06-19) · re-completion 500 → idempotent upserts (06-21) · 30-day completion-window bug fixed (06-21) · all-household reminders reach both phones (06-21) · `/reminders` rebuilt as the two-tab planner (Focus = `WebDayPlanner`, Assign = flexible assignment; `StandaloneRemindersPage` deleted) · Plan My Day + `day_plans` · **schema truth recovered** — `schema.sql` now carries `get_schedule_bundle` + 13 RLS policies (v1's O4, half of it, done).
**Stalled:** engine unification (Stage 2) · shared action UI (Stage 3) · `MobileItemForm` deletion · task-type retirement · every outward bridge.

## The next 3 moves

1. **Un-red the suite** — replace the stale source-regex guard with a behavioral test ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)). A permanently failing test teaches you to ignore failures.
2. **Delete `MobileItemForm.tsx`** — 15 minutes, third time flagged ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).
3. **Stage 2, surface by surface** — migrate views onto `expandOccurrences` with output-diff checks ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)).

**Sibling deep-dives:** [Budget](<../../Budget/FABLED 2/_index.md>) · [Kitchen](<../../Kitchen/FABLED 2/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 2/_index.md>) · [Trips](<../../Trips/FABLED 2/_index.md>) · [Notifications & Alerts](<../../Notifications & Alerts/FABLED 2/_index.md>) · [PM system](<../../FABLED 2/_index.md>)
