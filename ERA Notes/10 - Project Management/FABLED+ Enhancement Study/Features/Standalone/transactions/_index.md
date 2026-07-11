---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Transactions
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transactions · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Transactions** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** The strongest capture surface in the product, with multiple entry modes and disciplined money effects, but it treats a recorded transaction as a finished fact rather than a lifecycle that may still be uncertain or unreconciled.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 5/5 |
| **Decision** | 3/5 |
| **Action safety** | 4/5 |
| **Learning** | 2/5 |
| **Partnership** | 3/5 |
| **Total** | **21/30** |

This score measures closed-loop readiness, not feature maturity. Read the normal vault docs and FABLED 2 for the historical implementation narrative.

## Pack

| # | File | Use it for |
|---|---|---|
| 1 | [Feature State](<1 - Feature State.md>) | Current implementation, outcome loop, evidence, feedback, and risks. |
| 2 | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | Enhancement thesis, innovations, business value, and staged future. |
| 3 | [Action Plan](<3 - Action Plan.md>) | Ordered proofs, dependencies, gates, and non-goals. |
| 4 | [Checklist](<4 - Checklist.md>) | Checkable execution queue and definition of done. |

## Primary evidence

- `ERA Notes/01 - Architecture/Feature Map/standalone/transactions.md`
- `ERA Notes/02 - Standalone Modules/Transactions/Overview.md`
- `src/components/expense/MobileExpenseForm.tsx`
- `src/features/transactions/useDashboardTransactions.ts`
- `src/app/api/transactions/route.ts`
- `src/lib/utils/incomeExpense.ts`
- `src/types/statement.ts`

## Non-duplication boundary

Merchant intelligence, universal ingestion, conversational split, and generic explainable money already exist in prior studies; this roadmap concentrates on transaction truth lifecycle and correction economics.

