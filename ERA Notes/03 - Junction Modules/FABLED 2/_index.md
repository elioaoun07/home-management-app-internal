---
created: 2026-07-02
type: index
status: baseline-frozen
superseded: 2026-07-18
owner: Elio
tags:
  - pm/fabled2
  - scope/junction
---

# Junction Modules · FABLED 2 — Index

> ⚠️ **Frozen v2 baseline (2026-07-02)** — superseded 2026-07-18 by [`FABLED 3/`](<../FABLED 3/_index.md>) (model-generation handoff). Do not update; new history goes to the FABLED 3 delta ledger.


> The deep-dive over the **junction layer as a whole** — the bridges between standalones, which the FAR correctly identified as where this app's compound advantage lives. Verified against the working tree **2026-07-02**. Per-junction depth: [Hub & ERA](<../../10 - Project Management/Hub & ERA/FABLED 2/_index.md>), [Trips](<../../10 - Project Management/Trips/FABLED 2/_index.md>), [Notifications](<../../10 - Project Management/Notifications & Alerts/FABLED 2/_index.md>), Kitchen's Shopping List ([Kitchen FABLED 2](<../../10 - Project Management/Kitchen/FABLED 2/_index.md>)).

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You want the junction health matrix — every bridge, its direction, its verification state. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the layer's structural holes (one-way bridges, unverified cascades, the missing spine). |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You want the hardening order for cross-module correctness. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You want the junction-layer bets — the bridges that don't exist yet. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Bridge inventory** | 7 | Rich: chat→records, voice→drafts, shopping↔recipes↔inventory, trips→everything, household→all reads. |
| **Bridge direction** | 4 | Mostly one-way; facts recorded twice on both sides (money↔time). |
| **Cascade verification** | 2 | The widest cascade (Trips) never run end-to-end; household link expansion tested nowhere. |
| **The spine** | 1 | No signals layer, no composer, no policy — the junction that would connect all junctions is unbuilt. |
| **Overall** | **3.5** | Strong pairwise plumbing; no nervous system; one unverified heavy cascade. |

## The next 3 moves

1. **Verify the Trips cascade** — the layer's one irreversibility risk ([Trips FABLED 2.3](<../../10 - Project Management/Trips/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
2. **Rehearse the fact-bridge pattern small** — Debt→Reminder before Recurring↔Schedule ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).
3. **Start the spine policy-first** — delivery policy before composer before signals-store ([FAR FABLED 2.3](<../../10 - Project Management/Functional Architecture Review/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
