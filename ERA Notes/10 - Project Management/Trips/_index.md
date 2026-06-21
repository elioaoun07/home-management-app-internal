---
created: 2026-05-30
type: index
status: living
owner: Elio
tags:
  - pm/index
  - scope/module
  - module/trips
---

# Trips — Module PM Command Center

> Per-module strategic overview for **Trips** — the lifecycle-travel junction module: trips with activation/completion cascades, auto-created trip accounts, places, packing lists, and side-effects across Budget, Schedule/Chores, Meal Planning, and Catalogue.
>
> **Scope:** this folder is **Trips-only**. The root [10 - Project Management](<../_index.md>) set is **whole-app** scope. Trips is a **Junction** module — changes here cascade across several standalones, so its strategy is mostly about making those cascades *trustworthy* (same 4-doc format as [Schedule/](<../Schedule/_index.md>)).

| #   | File                                          | Read it when...                                                      |
| --- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1   | [Feature State](<1 - Feature State.md>)       | You want the honest, no-hype status of every Trips sub-feature.    |
| 2   | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | You want to dream: Trips enhancements + bridges, prioritized.      |
| 3   | [Action Plan](<3 - Action Plan.md>)           | The strategic call + candidate work — the *why, and in what order*. |
| 4   | [Checklist](<4 - Checklist.md>)               | **Most days.** The flat, checkable list — every task, Now/Next/Later. |
| F   | [FABLED/](<FABLED/_index.md>)                 | You want the 10× deep-dive: implementation X-ray (RPCs, side-effect ledger), the G1 verification checklist, optimization plan, future enhancements. |

## How to use this set

- **Daily driver:** file 4 (the checklist). Point at a line, a group, or a phase.
- **Files 1–3 are living:** update them as the module moves.
- **Files 1–2 set the strategy; file 3 frames the call; file 4 is the checkable queue.**

## Where this fits

- **Up one level:** the global command center → [10 - Project Management/_index.md](<../_index.md>). Read that for whole-app priorities.
- **Implementation reality (read before coding):** [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) — **read this first; the `trip_side_effects` ledger is critical** before touching activation/completion. That doc is the file-level source of truth; this folder is **strategy**, not a code map.
