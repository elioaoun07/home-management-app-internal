---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR · FABLED 2.3 — The Nervous System, July Edition

> **FABLED 2:** [_index](<_index.md>) · [1 · Scoreboard](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> FAR 7's Phase 2, re-sequenced for what June actually built and what it taught. This is assembly now, not construction.

---

## The re-sequenced spine

```
0. Credibility floor (one sweep):  un-red the suite · intent fixture table · commit PM tooling
1. Delivery Policy skeleton      (moved ahead of briefings — the G1 inversion)
2. Signals, cheapest-first:      Budget forecast series (lib exists) → Kitchen low-stock (query exists)
                                 → Schedule week-shape (needs Stage 2, the long pole)
3. First briefing = Budget-only  (one module, policy-gated, in-Hub card + one push)
4. Proposal lane:                low-stock → shopping proposal reusing the bulk-convert
                                 review-sheet semantics (shipped June, already proven)
5. Feedback recording            (act/dismiss columns — before any learning claims)
6. Then widen:                   Schedule signals after Stage 2 · Trips after verification
```

## What changed vs FAR 7 and why

| FAR 7 said | Now | Because |
|---|---|---|
| 2.1 insights/proposals schema first | **Defer the schema** — start with pure signal functions + existing `notifications` rows | June proved function-first works (`budgetForecast` shipped without a store); schema crystallizes after two real producers exist |
| 2.4 briefings, then 2.5 policy | **Policy first** | trust damage from unpoliced pushes is unrecoverable ([file 2 · G1](<2 - FABLED 2 — Gaps & Missing.md>)) |
| 2.2 Schedule + Budget signals together | **Budget first, Schedule after Stage 2** | Schedule's read model would sit on a three-engine fork today ([Schedule FABLED 2.2 · G1](<../../Schedule/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)) |
| 2.6 HubPage decomposition via briefing card | Unchanged — still the right vehicle | [Hub & ERA FABLED 2.3 · O2](<../../Hub & ERA/FABLED 2/3 - FABLED 2 — Optimization Plan.md>) |
| 2.7 inventory pilot for Action Inbox | Unchanged, cheaper | the review-sheet UX exists now |

## The gate, restated measurably

Phase 2 exit stays: **ERA speaks first ≥ once/day, correctly, within budget.** With the additions: suite green (gate credibility), act/dismiss recorded from day one (so Hit Rate/Regret are measurable), and ≤3 pushes/day enforced by code, not intention.
