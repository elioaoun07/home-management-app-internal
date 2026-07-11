---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Recurring Payments
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recurring Payments · Feature State

> [FABLED+ root](<../../../_index.md>) · **Recurring Payments** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A maturing commitment engine with new route contracts and coverage semantics, yet it still knows more about dates than about whether a real obligation was genuinely satisfied.

## Verified implementation footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/recurring-payments.md`
- `ERA Notes/02 - Standalone Modules/Recurring Payments/Overview.md`
- `src/features/recurring/commitments.ts`
- `src/features/recurring/commitments.test.ts`
- `src/app/recurring/page.tsx`
- `src/app/api/recurring-payments/[id]/mark-covered/route.ts`
- `src/app/api/recurring-payments/[id]/mark-covered/route.test.ts`

The footprint was checked against the working tree on 2026-07-11. Source code wins if a referenced document has drifted.

## Outcome-loop state

| Stage | Current state |
|---|---|
| **Observe** | Rules, due dates, expected amounts, transactions, and manual coverage are available. |
| **Interpret** | Commitment helpers classify due/covered/overdue states. |
| **Propose** | The redesigned page surfaces actions and matching opportunities. |
| **Commit** | Posting and mark-covered mutations are explicit. |
| **Verify** | Coverage can be acknowledged, but evidence quality and amount variance are weakly expressed. |
| **Learn** | The engine does not calibrate expected ranges or reminder behavior from outcomes. |

## What is already valuable

- Commitment calculations are isolated and tested rather than buried entirely in the page.
- The mark-covered route introduces an explicit human acknowledgement and route-level contract-test precedent.
- Forecast, future payments, account links, and coverage matching provide a strong base for obligation intelligence.

## Feedback: leverage gaps and risks

- Covered is a binary label even when evidence differs: exact matching transaction, partial amount, manual acknowledgement, or ambiguous statement row.
- Variable obligations need expected ranges and confidence, not a single stale amount that creates false alarms.
- A shared household can disagree about who owns, verified, or intentionally deferred a commitment; the current state does not capture that social fact.

## Study conclusion

**Inference:** Evolve recurring payments from a date generator into an obligation-assurance system that can say what is due, how sure it is, and what evidence closed the loop. The feature should not become “more AI” by default; it should make its truth, decision, and outcome boundaries more explicit.

## Re-verification commands

    rg --files "ERA Notes/01 - Architecture/Feature Map/standalone"
    git log --oneline --since="2026-07-02" -- "src/features/recurring/commitments.ts" "src/features/recurring/commitments.test.ts" "src/app/recurring/page.tsx"

Re-run the relevant focused tests before moving any score.

