---
created: 2026-07-02
type: index
status: baseline-frozen
superseded: 2026-07-18
owner: Elio
tags:
  - pm/fabled2
  - scope/performance
---

# Performance · FABLED 2 — Index

> ⚠️ **Frozen v2 baseline (2026-07-02)** — superseded 2026-07-18 by [`FABLED 3/`](<../FABLED 3/_index.md>) (model-generation handoff). Do not update; new history goes to the FABLED 3 delta ledger.


> The deep-dive audit of the app's **performance posture** — what's been optimized (and documented here), what's never been measured, and where the next real wins are. Verified **2026-07-02**.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You want the inventory of shipped optimizations and their patterns. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want what's unmeasured, unbudgeted, and quietly expensive. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You want the measure-first hardening moves. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You want the perf-infrastructure bets. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Query-layer discipline** | 8 | RPC bundling (HR 20/21), documented TTLs, persisted cache, prefetch utils — learned from real 1.3s-floor pain. |
| **Measurement** | 2 | No web vitals, no perf budget, no bundle-size tracking, no route-timing telemetry. Optimizations happen on felt pain only. |
| **Client payload** | 4 | Megafiles ship as monoliths (HubPage 5,798 LOC); dynamic-import discipline exists in places (voice SDK lazy-load) but is uninventoried. |
| **Prod overhead** | 4 | 594 `console.*` in prod slow DevTools overlay and leak state (HR 22 rationale); infinite animations tick timers. |
| **Overall** | **4.5** | Good instincts, no instruments — the app optimizes reactively and can't see regressions coming. |

## The next 3 moves

1. **Instrument before optimizing** — web vitals + route timings, one afternoon ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)).
2. **Measure the budget read path** — the `get_budget_bundle` decision needs numbers, not faith ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).
3. **Split the biggest parse cost when next touched** — HubPage decomposition is also a perf move ([Hub & ERA FABLED 2.3 · O2](<../../10 - Project Management/Hub & ERA/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
