---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Transfers
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transfers · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Transfers** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A narrow but high-risk capability with strong paired-money semantics; it records movement correctly but loses the intent, safety boundary, and follow-up expectation that made the transfer meaningful.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 3/5 |
| **Decision** | 3/5 |
| **Action safety** | 5/5 |
| **Learning** | 1/5 |
| **Partnership** | 2/5 |
| **Total** | **18/30** |

This score measures closed-loop readiness, not feature maturity. Read the normal vault docs and FABLED 2 for the historical implementation narrative.

## Pack

| # | File | Use it for |
|---|---|---|
| 1 | [Feature State](<1 - Feature State.md>) | Current implementation, outcome loop, evidence, feedback, and risks. |
| 2 | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | Enhancement thesis, innovations, business value, and staged future. |
| 3 | [Action Plan](<3 - Action Plan.md>) | Ordered proofs, dependencies, gates, and non-goals. |
| 4 | [Checklist](<4 - Checklist.md>) | Checkable execution queue and definition of done. |

## Primary evidence

- `ERA Notes/01 - Architecture/Feature Map/standalone/transfers.md`
- `ERA Notes/02 - Standalone Modules/Transfers/Overview.md`
- `src/features/transfers/hooks.ts`
- `src/app/api/transfers/route.ts`
- `src/app/api/transfers/[id]/route.ts`
- `src/components/expense/TransferDialog.tsx`
- `src/lib/balance-utils.ts`

## Non-duplication boundary

Generic envelope funding and broad cashflow simulation are already planned; these bets make the transfer itself auditable and purpose-aware.

