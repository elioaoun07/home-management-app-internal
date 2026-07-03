---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/performance
---

# Performance · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — The perf dashboard tile (make posture visible weekly)

Once O1's vitals land in Error Logs (or a sink), one PM-dashboard tile: p75 LCP/INP per top route, trend arrow, last build's first-load JS. Performance stops being a special investigation and becomes a glance ([PM FABLED 2.4 · E2](<../../10 - Project Management/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) reconciliation pattern).

## E2 — Offline-first reads for the daily loop

**Impact: High felt (PWA identity) · Effort: M–H**

The mutation path is offline-hardened; the *read* path still needs the network for freshness. For the daily-driver surfaces (today's items, balances), a service-worker stale-while-revalidate layer over the bundle RPCs would make cold-open instant and airplane-mode useful. **Kill criterion:** measure first (O1) — if warm-cache cold-open is already <1s on the real phone, the complexity isn't worth it.

## E3 — Islanding the megafiles

The HubPage/expense-form decompositions ([Hub & ERA FABLED 2.3 · O2](<../../10 - Project Management/Hub & ERA/FABLED 2/3 - FABLED 2 — Optimization Plan.md>), [Budget FABLED 2.3 · O4](<../../10 - Project Management/Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) are also chunk-split opportunities: per-view dynamic imports so the alerts view doesn't pay for shopping mode. Ride the decompositions; never split speculatively.

## E4 — Edge-cache the read-only public surfaces

Guest portal + NFC tag pages are public, slug-addressed, and rarely changing — ideal for full-route caching/ISR. Small win, but these are the surfaces *other people* see; first impressions carry the household's reputation.

## E5 — Perf budget as a hard rule

When O1–O3 have run for a quarter, promote the numbers to a CLAUDE.md hard rule (route p75 budgets + bundle ceilings) so every future session inherits the constraint the way it inherits HR 20/21 today. Budgets without history are guesses; earn them first.

---

## Recommended order

```
E1 (rides O1) → E3 (rides decompositions) → E4 (one afternoon) → E2 (measure-gated) → E5 (after a quarter of data)
```
