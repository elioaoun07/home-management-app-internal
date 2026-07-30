---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Future Purchases
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Future Purchases · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Future Purchases** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A useful wishlist and savings bridge that records what may be bought, but not why the desire exists, how it changes, or whether buying remains better than repairing, borrowing, or waiting.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 3/5 |
| **Decision** | 2/5 |
| **Action safety** | 3/5 |
| **Learning** | 1/5 |
| **Partnership** | 1/5 |
| **Total** | **13/30** |

Loop readiness is not FABLED maturity. It measures whether facts become safe decisions, verified outcomes, and learning.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/future-purchases.md`
- `ERA Notes/02 - Standalone Modules/Future Purchases/Overview.md`
- `src/features/future-purchases/hooks.ts`
- `src/components/web/WebFuturePurchases.tsx`
- `src/app/api/future-purchases/route.ts`
- `src/app/api/future-purchases/[id]/allocate/route.ts`
- `migrations/schema.sql`

## Non-duplication boundary

Future-purchase→transaction auto-complete and broad what-if simulation already exist; these ideas improve decision quality before purchase.

