---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Budget Allocation
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Budget Allocation · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Budget Allocation** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A capable envelope planner with AI-assisted suggestions, but allocations remain static targets instead of negotiated, confidence-aware commitments that adapt to actual household behavior.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 2/5 |
| **Decision** | 3/5 |
| **Action safety** | 3/5 |
| **Learning** | 1/5 |
| **Partnership** | 2/5 |
| **Total** | **14/30** |

Loop readiness is not FABLED maturity. It measures whether facts become safe decisions, verified outcomes, and learning.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/budget-allocation.md`
- `ERA Notes/02 - Standalone Modules/Budget Allocation/Overview.md`
- `src/features/budget/hooks.ts`
- `src/lib/budget/budgetForecast.ts`
- `src/app/api/budget-allocations/route.ts`
- `src/app/api/ai-budget-suggestions/route.ts`
- `migrations/schema.sql`

## Non-duplication boundary

Envelope funding, recurring-driven suggestions, cashflow forecast, and Sunday money review are existing roadmap ideas; this pack adds uncertainty, intent, and negotiation semantics.

