---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/performance
---

# Performance · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🔴 G1 — Zero instrumentation

No web vitals, no route timings, no bundle-size record, no slow-query log review cadence. Consequence: regressions are discovered by feel, on the maintainer's own devices, possibly weeks late — and every optimization debate ("do we need `get_budget_bundle`?") stalls at opinions. The schedule-bundle win was only possible because someone finally *measured* the 1.3s floor; nothing today would surface the next 1.3s floor automatically.

## 🟠 G2 — The dashboard read path is the standing suspect

Accounts + balances + recent transactions + recurring as separate PostgREST calls on the landing surface — the exact shape HR 21 exists for. v1-era Budget FABLED said "measure first, the caches may hide it"; nobody measured. It remains the most likely materially-slow read in the app.

## 🟠 G3 — Client bundle composition is unknown

Next 15 + turbopack, but no `next build` size report is recorded anywhere, no budget set, and the megafile chunks (HubPage on the primary route) ship whole. Whether the app's TTI on a mid-range phone is 2s or 6s is *currently unknowable from the repo*.

## 🟡 G4 — Prod overhead from hygiene debt

594 `console.*` (some in hot render paths and cron loops) + infinite animations + React Query DevTools if shipped — each small, all unmeasured, all in the "we'd never notice a 15% drag" class. The hygiene sweeps fix them for correctness reasons; perf is the free rider.

## 🟡 G5 — Growth-unbounded client computations

The outlier engine and Review v3 charts recompute over *all* history windows on the client. At current volume: fine. At 3 years of household data: unknown. No memoization audit, no row-count guardrails, no "compute on server after N rows" threshold.

## ⚪ G6 — This directory documents victories, not posture

Three docs record completed campaigns (`Performance Optimizations`, `Refactoring Complete`, `UI Polish`) — useful history, no living baseline. The FABLED 2 layer now carries the posture; keep it that way.
