---
created: 2026-05-30
type: index
status: living
owner: Elio
tags:
  - pm/index
  - scope/module
  - module/kitchen
---

# Kitchen — Module PM Command Center

> Per-module strategic overview for **Kitchen** — the household food domain: Recipes, Meal Planning, Inventory, and the Shopping List that ties them together.
>
> **Scope:** this folder is **Kitchen-only**. The root [10 - Project Management](<../_index.md>) set is **whole-app** scope. Recipes / Meal Planning / Inventory are independent standalone modules and Shopping List is a junction between them — here they're treated as sub-features of one food domain (the same way [Schedule/](<../Schedule/_index.md>) treats Items & Reminders).

| #   | File                                                                       | Read it when...                                                        |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | [Feature State — Current Reality](<1 - Feature State — Current Reality.md>) | You want the honest, no-hype status of every Kitchen sub-feature.     |
| 2   | [Future Vision & Roadmap](<2 - Future Vision & Roadmap.md>)                 | You want to dream: Kitchen enhancements + bridges, prioritized.       |
| 3   | [Current — Action Plan](<3 - Current — Action Plan.md>)                     | Most days. What to actually do next on Kitchen (this week or later).  |
| F   | [FABLED/](<FABLED/_index.md>)                                               | You want the 10× deep-dive: current implementation X-ray (incl. the loop-link table), ranked gaps, optimization plan, future enhancements. |

## How to use this set

- **Daily driver:** file 3. It's a living queue ("might be this week, might be later"), not a fixed Mon–Fri grid.
- **Files 1–2 are living:** update them as the domain moves.
- **Files 1–2 set the strategy; file 3 turns it into the next concrete steps.**

## Where this fits

- **Up one level:** the global command center → [10 - Project Management/_index.md](<../_index.md>). Read that for whole-app priorities.
- **Implementation reality (read before coding):** [Recipes / Overview](<../../02 - Standalone Modules/Recipes/Overview.md>), [Inventory / Overview](<../../02 - Standalone Modules/Inventory/Overview.md>), [Meal Planning / Overview](<../../03 - Junction Modules/Meal Planning/Overview.md>), [Shopping List / Overview](<../../03 - Junction Modules/Shopping List/Overview.md>). Those are the file-level source of truth; this folder is **strategy**, not a code map.
