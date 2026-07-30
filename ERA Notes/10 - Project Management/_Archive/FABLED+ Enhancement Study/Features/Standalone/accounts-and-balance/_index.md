---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Accounts & Balance
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Accounts & Balance · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Accounts & Balance** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A trustworthy money kernel with strong write discipline, but the UI presents balances as exact truth even when freshness, pending offline work, and reconciliation confidence differ.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 3/5 |
| **Decision** | 3/5 |
| **Action safety** | 4/5 |
| **Learning** | 2/5 |
| **Partnership** | 3/5 |
| **Total** | **19/30** |

This score measures closed-loop readiness, not feature maturity. Read the normal vault docs and FABLED 2 for the historical implementation narrative.

## Pack

| # | File | Use it for |
|---|---|---|
| 1 | [Feature State](<1 - Feature State.md>) | Current implementation, outcome loop, evidence, feedback, and risks. |
| 2 | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | Enhancement thesis, innovations, business value, and staged future. |
| 3 | [Action Plan](<3 - Action Plan.md>) | Ordered proofs, dependencies, gates, and non-goals. |
| 4 | [Checklist](<4 - Checklist.md>) | Checkable execution queue and definition of done. |

## Primary evidence

- `ERA Notes/01 - Architecture/Feature Map/standalone/accounts-and-balance.md`
- `ERA Notes/02 - Standalone Modules/Accounts & Balance/Overview.md`
- `src/features/accounts/hooks.ts`
- `src/features/balance/hooks.ts`
- `src/lib/balance-utils.ts`
- `src/app/api/accounts/route.ts`
- `migrations/schema.sql`

## Non-duplication boundary

Cashflow forecasting, generic explainable-money drill-downs, and an event spine are already covered elsewhere; these bets focus on balance truth and operational safety.

