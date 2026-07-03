---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/performance
---

# Performance · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> The directory's own rule governs everything here: **measure first**. No optimization below starts without its number.

---

## O1 — Minimum instrumentation (fixes G1; one afternoon)

1. `reportWebVitals` → a tiny `/api/vitals` sink or just the Error Logs module (LCP/INP/CLS per route, sampled).
2. Record one `next build` output (route sizes, first-load JS) into this directory as the baseline file; re-record monthly or per big feature.
3. A 15-minute Supabase slow-query review added to the monthly delta ritual.

## O2 — Measure the dashboard read path, then decide (fixes G2)

Network-tab (or vitals-sink timing) on cold + warm dashboard load. If floor > ~500ms cold: build `get_budget_bundle()` on the `get_schedule_bundle` template (SECURITY DEFINER, one round-trip, per HR 20/21 + repo-fidelity rule). If not: write the number down here and close the question — an answered "no" is as valuable as a bundle.

## O3 — Bundle-size ratchet (fixes G3 permanently, cheaply)

With O1.2's baseline: fail CI/pre-commit if first-load JS for the top routes grows >10% without a recorded ack. Same ratchet philosophy as console/fetch ([Audit FABLED 2.4 · E3](<../../10 - Project Management/Codebase Audit 2026-07-01/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)).

## O4 — Dynamic-import the obvious three (after O1 confirms)

Candidates by construction: recharts (Review tabs + AnalysisDashboard — chart code on non-chart routes), the QR scanner, cooking-mode/page-flip assets. Each is a `next/dynamic` wrapper; verify with the O1.2 build diff.

## O5 — Guardrails on growth-unbounded computations (fixes G5)

Row-count thresholds on the outlier engine + chart datasets (beyond N rows: server-side or windowed), plus a memoization check on Review v3 tab switches (the June "filters persist across tabs" fix suggests renders were already re-running wholesale).

---

### Sequencing

```
O1 (instruments) → O2 (the standing question, answered with numbers)
  → O3 (ratchet) → O4 (three dynamic imports) → O5 (when data volume warrants)
```
