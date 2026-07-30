---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Transfers
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transfers · Feature State

> [FABLED+ root](<../../../_index.md>) · **Transfers** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A narrow but high-risk capability with strong paired-money semantics; it records movement correctly but loses the intent, safety boundary, and follow-up expectation that made the transfer meaningful.

## Verified implementation footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/transfers.md`
- `ERA Notes/02 - Standalone Modules/Transfers/Overview.md`
- `src/features/transfers/hooks.ts`
- `src/app/api/transfers/route.ts`
- `src/app/api/transfers/[id]/route.ts`
- `src/components/expense/TransferDialog.tsx`
- `src/lib/balance-utils.ts`

The footprint was checked against the working tree on 2026-07-11. Source code wins if a referenced document has drifted.

## Outcome-loop state

| Stage | Current state |
|---|---|
| **Observe** | Source, destination, amount, date, and template context are captured. |
| **Interpret** | Account types determine paired balance deltas. |
| **Propose** | Templates prefill, but safety reasoning is limited. |
| **Commit** | Paired changes are the module's central invariant. |
| **Verify** | The transfer record exists; user-facing reconciliation receipt is weak. |
| **Learn** | No loop evaluates whether the transfer achieved its stated purpose. |

## What is already valuable

- A transfer is modeled as one paired operation rather than two unrelated transactions.
- Optimistic cache work and account-type math reuse the finance invariants.
- Templates and NFC wallet shortcuts prove the capability can be embedded in lower-friction contexts.

## Feedback: leverage gaps and risks

- Purpose is disposable context. A wallet refill, savings move, correction, and temporary float look identical later.
- The UI does not preview post-transfer safety against account buffers or pending offline work.
- Retries, partner visibility, and a future reversal need one durable operation identity to remain explainable across both accounts.

## Study conclusion

**Inference:** Preserve transfer intent and prove paired effects, so every move is understandable before, during, and after commitment. The feature should not become “more AI” by default; it should make its truth, decision, and outcome boundaries more explicit.

## Re-verification commands

    rg --files "ERA Notes/01 - Architecture/Feature Map/standalone"
    git log --oneline --since="2026-07-02" -- "src/features/transfers/hooks.ts" "src/app/api/transfers/route.ts" "src/app/api/transfers/[id]/route.ts"

Re-run the relevant focused tests before moving any score.

