---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Future Purchases
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Future Purchases · Feature State

> [FABLED+ root](<../../../_index.md>) · **Future Purchases** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A useful wishlist and savings bridge that records what may be bought, but not why the desire exists, how it changes, or whether buying remains better than repairing, borrowing, or waiting.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/future-purchases.md`
- `ERA Notes/02 - Standalone Modules/Future Purchases/Overview.md`
- `src/features/future-purchases/hooks.ts`
- `src/components/web/WebFuturePurchases.tsx`
- `src/app/api/future-purchases/route.ts`
- `src/app/api/future-purchases/[id]/allocate/route.ts`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; current source wins over documentation.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Desired item, price, dates, notes, and allocations are captured. |
| **Interpret** | Progress toward a target is calculated. |
| **Propose** | The module offers limited help deciding whether or when to buy. |
| **Commit** | Users allocate money and mark outcomes. |
| **Verify** | Actual price and decision rationale are not systematically compared. |
| **Learn** | Abandoned, delayed, repaired, or regretted purchases do not improve later decisions. |

## Existing leverage

- Purchase ideas, target amounts, savings allocation, and completion state create a concrete intention record.
- The feature connects desire to real financial capacity instead of being a detached list.
- Allocation and CRUD flows are already established.

## Feedback, friction, and risk

- The list preserves objects but loses desire strength, trigger, alternatives, and change over time.
- Completion treats purchase as success; a deliberate no-buy, repair, borrow, or substitute is invisible.
- Shared purchases need preference, contribution, and privacy semantics before they become a household decision.

## Study conclusion

**Inference:** Turn future purchases into an intentional decision pipeline that makes waiting, repairing, and declining as legible as buying.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/future-purchases/hooks.ts" "src/components/web/WebFuturePurchases.tsx" "src/app/api/future-purchases/route.ts" "src/app/api/future-purchases/[id]/allocate/route.ts"

Re-read every mutating route and run focused tests before implementation.

