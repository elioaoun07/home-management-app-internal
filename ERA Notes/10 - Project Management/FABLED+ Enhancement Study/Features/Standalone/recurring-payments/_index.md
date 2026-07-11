---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Recurring Payments
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recurring Payments · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Recurring Payments** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A maturing commitment engine with new route contracts and coverage semantics, yet it still knows more about dates than about whether a real obligation was genuinely satisfied.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 3/5 |
| **Decision** | 4/5 |
| **Action safety** | 4/5 |
| **Learning** | 2/5 |
| **Partnership** | 2/5 |
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

- `ERA Notes/01 - Architecture/Feature Map/standalone/recurring-payments.md`
- `ERA Notes/02 - Standalone Modules/Recurring Payments/Overview.md`
- `src/features/recurring/commitments.ts`
- `src/features/recurring/commitments.test.ts`
- `src/app/recurring/page.tsx`
- `src/app/api/recurring-payments/[id]/mark-covered/route.ts`
- `src/app/api/recurring-payments/[id]/mark-covered/route.test.ts`

## Non-duplication boundary

Cashflow forecast, recurring↔schedule unification, subscription auditing, and Sunday money rituals are existing ideas; this pack targets evidence and assurance.

