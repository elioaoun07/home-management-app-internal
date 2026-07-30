---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Transactions
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transactions · Feature State

> [FABLED+ root](<../../../_index.md>) · **Transactions** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

The strongest capture surface in the product, with multiple entry modes and disciplined money effects, but it treats a recorded transaction as a finished fact rather than a lifecycle that may still be uncertain or unreconciled.

## Verified implementation footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/transactions.md`
- `ERA Notes/02 - Standalone Modules/Transactions/Overview.md`
- `src/components/expense/MobileExpenseForm.tsx`
- `src/features/transactions/useDashboardTransactions.ts`
- `src/app/api/transactions/route.ts`
- `src/lib/utils/incomeExpense.ts`
- `src/types/statement.ts`

The footprint was checked against the working tree on 2026-07-11. Source code wins if a referenced document has drifted.

## Outcome-loop state

| Stage | Current state |
|---|---|
| **Observe** | Transactions enter from form, voice, templates, Hub, receipts, and imports. |
| **Interpret** | Category, account type, merchant normalization, and split logic add meaning. |
| **Propose** | Drafts and parsed entries support review before commit. |
| **Commit** | Create/update/delete flows affect balances and caches. |
| **Verify** | Imported duplicates and balance math receive some checks; settlement state is not explicit. |
| **Learn** | Merchant corrections can teach mappings, but broader capture corrections are not measured as a product loop. |

## What is already valuable

- Form, voice, templates, drafts, Hub actions, receipts, and statement import give the module exceptional capture reach.
- Canonical spend semantics and balance adjustments encode hard-won correctness rules.
- The current merchant-mapping work creates a valuable correction signal instead of relying on model guesses alone.

## Feedback: leverage gaps and risks

- Recorded, authorized, settled, imported, and reconciled money are collapsed into one lifecycle state, hiding uncertainty that matters for cash and statements.
- Correction signals are scattered: category edits, amount edits, duplicate removals, and Undo do not form one measurable capture-quality loop.
- The 2,999-line mobile form is a concentration of behavior; changing capture policy risks unrelated regressions even when TypeScript stays green.

## Study conclusion

**Inference:** Make transaction capture progressively truthful: commit fast, preserve uncertainty, then graduate the record to reconciled truth with minimal follow-up. The feature should not become “more AI” by default; it should make its truth, decision, and outcome boundaries more explicit.

## Re-verification commands

    rg --files "ERA Notes/01 - Architecture/Feature Map/standalone"
    git log --oneline --since="2026-07-02" -- "src/components/expense/MobileExpenseForm.tsx" "src/features/transactions/useDashboardTransactions.ts" "src/app/api/transactions/route.ts"

Re-run the relevant focused tests before moving any score.

