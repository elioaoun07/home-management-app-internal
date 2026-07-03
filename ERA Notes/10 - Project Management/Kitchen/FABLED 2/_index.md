---
created: 2026-07-02
type: index
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/kitchen
---

# Kitchen · FABLED 2 — Index

> Second-generation deep-dive, superseding [FABLED v1](<../FABLED/_index.md>) (2026-06-10). Re-verified against the working tree **2026-07-02**. Kitchen's defining fact this generation: **almost nothing moved since v1** — June's energy went to Budget, Schedule, and Hub. That is not neutral: the loop-link table's ❌ rows are unchanged while the modules around Kitchen grew the exact capabilities (projections, AI contracts, planner surfaces) that make closing them cheaper than ever.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You need the domain X-ray + the re-verified loop-link table (the domain's whole roadmap). |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the ranked absences — unchanged rows now carry an escalation argument. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You're about to build the keystone and want the substrate order. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You're planning the Kitchen campaign — v1's ladder plus three newly-cheap ideas. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Individual tools** | 7 | Recipes (with a full AI surface), Meal Planning, Inventory, Shopping List all work standalone. |
| **Loop closure** | 2 | 4 of 9 loop links built; the keystone (low-stock → auto-add) still one wiring step away, 3+ months flagged. |
| **AI surface protection** | 3 | `extract-from-url` (21 KB) + optimize/scale/substitute still have zero fixtures; prompt drift is invisible. |
| **Outward bridges** | 2 | Planned meals still invisible to calendar/Today/ERA; no price layer. |
| **Test protection** | 1 | Zero tests domain-wide — now the *only* campaign domain at zero (Budget and Schedule both built baselines). |
| **Overall** | **3.0** | Strong tools, absent nervous system — the gap between Kitchen and its siblings widened in June. |

## Delta since FABLED v1 — the headline

**Nothing in-domain shipped.** Loop-link table: identical. Tests: still zero. What changed is the *neighborhood*: Plan My Day gives planned meals a natural surfacing slot, Budget's `AnalysisReport` pattern is a copy-paste seam for a pantry report, `normalizeMerchant` brings grocery price observations closer, and the drafts/proposal pattern (Hub bulk-convert) is the exact UX the low-stock auto-add proposal needs. Kitchen's next campaign starts from a richer platform than v1 could assume.

## The next 3 moves

1. **Threshold semantics test + stock invariants** — the substrate the keystone needs ([file 3 · O1/O2](<3 - FABLED 2 — Optimization Plan.md>)).
2. **The keystone trigger** — low-stock → shopping proposal, idempotent, server-side ([file 2 · G1](<2 - FABLED 2 — Gaps & Missing.md>)).
3. **Meals onto time surfaces** — the cheapest visible win, now cheaper via the planner ([file 4 · E6](<4 - FABLED 2 — Future Enhancements.md>)).

**Sibling deep-dives:** [Budget](<../../Budget/FABLED 2/_index.md>) · [Schedule](<../../Schedule/FABLED 2/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 2/_index.md>) · [Trips](<../../Trips/FABLED 2/_index.md>) · [Notifications & Alerts](<../../Notifications & Alerts/FABLED 2/_index.md>) · [PM system](<../../FABLED 2/_index.md>)
