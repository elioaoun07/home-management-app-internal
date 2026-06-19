---
created: 2026-05-30
updated: 2026-06-19
type: index
status: living
owner: Elio
tags:
  - pm/index
  - scope/module
  - module/schedule
---

# Schedule — Module PM Command Center

> Per-module strategic command center for **Schedule** (the *Items & Reminders* module — reminders, events, tasks, recurring & flexible routines, the calendar/today/week views, alerts, prerequisites, subtasks).
>
> **Scope:** this folder is **Schedule-only**. The root [10 - Project Management](<../_index.md>) set is **whole-app** scope. Sibling per-module folders use a similar format — see [Budget/](<../Budget/_index.md>), [Kitchen/](<../Kitchen/_index.md>), [Trips/](<../Trips/_index.md>), [Hub & ERA/](<../Hub & ERA/_index.md>) (full list in the root [_index](<../_index.md>)).
>
> **Why this set exists:** Schedule is 🟢 Core and stable, but it *felt* heavy, confusing, and under-used, and the trickiest logic (recurrence + occurrence actions + the flexible placement rule) was untested. The ask was deliberate — *document every painful thing and every sub-feature first*, set expectations, then run a focused overhaul. This folder is that map **plus** the build queue. (Consolidated 2026-06-19 from the former standing-strategy files + the "Pain Inventory & Plan" campaign sub-folder into one flat set.)

| #   | File                                                                    | Read it when...                                                             |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | [Feature State & Pain Inventory](<1 - Feature State & Pain Inventory.md>) | You want the honest, no-hype status of every Schedule sub-feature **and** the full list of what hurts (every pain, root cause, severity). |
| 2   | [Vision, Target Design & Decisions](<2 - Vision, Target Design & Decisions.md>) | You want where the module is *heading* — enhancements + cross-module bridges, the prioritization matrix, and the calls already locked. |
| 3   | [Type Taxonomy & Capture Design](<3 - Type Taxonomy & Capture Design.md>) | You want the "what are Task/Reminder/Event/Chore?" answer, the mobile-form refactor blueprint, and how the external `0 - My Plan.MD` brief reconciles with app reality. |
| 4   | [Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>) | You hit "Skip duplicated my recurring item" / "recurring feels messy" — the code-confirmed root cause, the three diverging expansion engines, the staged fix. |
| 5   | [Execution Plan & Build Checklist](<5 - Execution Plan & Build Checklist.md>) | **Most days.** What to actually do next — the sequenced Now/Next/Later queue *and* the single phased, checkable build list (point at a line, group, or phase). |
| F   | [FABLED/](<FABLED/_index.md>)                                           | You want the 10× deep-dive: implementation X-ray (placement strategies, RPC, form traps), ranked gaps, optimization plan, future enhancements. *(Not consolidated — read as its own set.)* |

## How to use this set

1. **Read 1 first** — the whole picture: current maturity of every sub-feature + the full pain map (ends with a ranked Top pains for instant scope).
2. **Read 2** — where each pain is heading + the committed decisions (Focus → per-item mode; household co-edit; both capture lanes; no geofencing) + the open questions.
3. **Read 3** when you touch the capture form or the type model.
4. **Read 4** before touching recurrence/occurrence-action code — it's the current top live correctness risk.
5. **Work from 5** — it's the daily driver: a living Now/Next/Later queue **and** the flattened build checklist. Tell it a line, a group, or a phase.

## Where this fits

- **Up one level:** the global command center → [10 - Project Management/_index.md](<../_index.md>). Read that for whole-app priorities.
- **Implementation reality (read before coding):** [Items & Reminders / Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) and [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>). Those are the file-level source of truth; this folder is **strategy + audit + queue**, not a code map.
