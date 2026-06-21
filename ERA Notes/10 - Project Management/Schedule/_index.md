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

| #   | File                                          | Read it when...                                                             |
| --- | --------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | [Feature State](<1 - Feature State.md>)       | You want the honest, no-hype status of every Schedule sub-feature **and** the full Pain Inventory (every pain, root cause, severity). |
| 2   | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | Where the module is *heading* — vision + roadmap, target design & locked decisions, **plus the folded-in Type Taxonomy & Capture Design and Recurrence & Occurrence Actions** deep-designs (the "what are Task/Reminder/Event?" model, the form blueprint, and the Skip/recurrence root cause + staged fix). |
| 3   | [Action Plan](<3 - Action Plan.md>)           | The call + sequenced Now/Next/Later queue + candidate-work tables (the *why, and in what order*); the originating **My Plan** brief is its appendix. |
| 4   | [Checklist](<4 - Checklist.md>)               | **Most days.** The flat, phased, checkable Master Build Checklist (IDs + severity + effort). |
| F   | [FABLED/](<FABLED/_index.md>)                 | You want the 10× deep-dive: implementation X-ray (placement strategies, RPC, form traps), ranked gaps, optimization plan, future enhancements. *(Not consolidated — read as its own set.)* |

## How to use this set

1. **Read 1 first** — the whole picture: current maturity of every sub-feature + the full pain map (ends with a ranked Top pains for instant scope).
2. **Read 2** — where each pain is heading + the committed decisions (Focus → per-item mode; household co-edit; both capture lanes; no geofencing), **and** the folded-in Type Taxonomy and Recurrence deep-designs — read these before touching the capture form/type model or recurrence/occurrence-action code (the latter is the top live correctness risk).
3. **Read 3** — the call + the Now/Next/Later queue (the *why, and in what order*); the originating My Plan brief is its appendix.
4. **Work from 4** — the daily driver: the flat, phased Master Build Checklist. Tell it a line, a group, or a phase.

## Where this fits

- **Up one level:** the global command center → [10 - Project Management/_index.md](<../_index.md>). Read that for whole-app priorities.
- **Implementation reality (read before coding):** [Items & Reminders / Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) and [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>). Those are the file-level source of truth; this folder is **strategy + audit + queue**, not a code map.
