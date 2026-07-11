---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Inventory
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Inventory · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Inventory** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A practical stock and restock module embedded in Catalogue, but it represents quantity as certainty even when household inventory is usually estimated, distributed across locations, and decaying over time.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 2/5 |
| **Capture** | 3/5 |
| **Decision** | 2/5 |
| **Action safety** | 3/5 |
| **Learning** | 1/5 |
| **Partnership** | 2/5 |
| **Total** | **13/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/inventory.md`
- `ERA Notes/02 - Standalone Modules/Inventory/Overview.md`
- `src/features/inventory/hooks.ts`
- `src/components/inventory`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/inventory/stock/[itemId]/route.ts`
- `src/app/api/inventory/restock/route.ts`

## Non-duplication boundary

Self-driving shopping, pantry-aware recipes, unit canonicalization, barcode/OCR, and waste tracking are prior ideas; this pack focuses on inventory truth.

