---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Inventory
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Inventory · Feature State

> [FABLED+ root](<../../../_index.md>) · **Inventory** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A practical stock and restock module embedded in Catalogue, but it represents quantity as certainty even when household inventory is usually estimated, distributed across locations, and decaying over time.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/inventory.md`
- `ERA Notes/02 - Standalone Modules/Inventory/Overview.md`
- `src/features/inventory/hooks.ts`
- `src/components/inventory`
- `src/app/api/inventory/items/route.ts`
- `src/app/api/inventory/stock/[itemId]/route.ts`
- `src/app/api/inventory/restock/route.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Items, quantities, stock changes, restock, and barcode context are captured. |
| **Interpret** | Low-stock thresholds produce status. |
| **Propose** | Restock and add-to-shopping actions are available. |
| **Commit** | Stock and restock mutations update state. |
| **Verify** | Physical reality is not distinguished from estimate or stale count. |
| **Learn** | Consumption pace, correction frequency, and location are not calibrated. |

## Existing leverage

- Stock counts, restock history, barcode support, and shopping-list bridges already exist.
- Catalogue embedding reuses product identity and avoids a new top-level navigation burden.
- Low-stock state can become a decision signal without AI.

## Feedback, friction, and risk

- Exact quantity creates false confidence when users estimate or forget consumption.
- One item may exist in pantry, freezer, bathroom, car, or another person's possession.
- Corrections are treated as edits rather than signals about decay, cadence, or capture friction.

## Study conclusion

**Inference:** Make inventory honestly approximate: confidence, location, decay, and lightweight verification instead of pretending every count is a live database fact.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/inventory/hooks.ts" "src/components/inventory" "src/app/api/inventory/items/route.ts" "src/app/api/inventory/stock/[itemId]/route.ts"

Run focused tests and read mutating routes before implementation.

