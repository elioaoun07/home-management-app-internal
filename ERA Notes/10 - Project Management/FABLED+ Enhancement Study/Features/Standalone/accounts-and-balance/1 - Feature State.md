---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Accounts & Balance
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Accounts & Balance · Feature State

> [FABLED+ root](<../../../_index.md>) · **Accounts & Balance** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A trustworthy money kernel with strong write discipline, but the UI presents balances as exact truth even when freshness, pending offline work, and reconciliation confidence differ.

## Verified implementation footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/accounts-and-balance.md`
- `ERA Notes/02 - Standalone Modules/Accounts & Balance/Overview.md`
- `src/features/accounts/hooks.ts`
- `src/features/balance/hooks.ts`
- `src/lib/balance-utils.ts`
- `src/app/api/accounts/route.ts`
- `migrations/schema.sql`

The footprint was checked against the working tree on 2026-07-11. Source code wins if a referenced document has drifted.

## Outcome-loop state

| Stage | Current state |
|---|---|
| **Observe** | Balances, history, archives, and account metadata are captured. |
| **Interpret** | Type-aware math and summaries interpret direction and totals. |
| **Propose** | Limited; the module mostly reports rather than recommends. |
| **Commit** | Account and balance mutations are established and optimistic. |
| **Verify** | History exists, but reconciliation confidence is not a first-class user concept. |
| **Learn** | No closed loop measures whether suggestions or transfers improved liquidity. |

## What is already valuable

- Account-type sign rules and balance changes already pass through recognizable choke points.
- History, daily summaries, archives, public/private flags, and household-expanded reads provide unusually rich evidence for a personal app.
- Optimistic mutations and current-user account selection keep the high-frequency expense path fast.

## Feedback: leverage gaps and risks

- A displayed balance has no visible truth envelope: last verified checkpoint, pending offline mutations, and derived-vs-observed status are collapsed into one number.
- Household visibility is modeled, but shared decisions such as moving a safety buffer lack consent or acknowledgement semantics.
- Balance history explains chronology, not causality; a user cannot quickly distinguish a real-world correction from transaction-driven movement.

## Study conclusion

**Inference:** Turn every balance from a naked number into an accountable household position: how fresh it is, why it moved, what is protected, and which decisions remain safe. The feature should not become “more AI” by default; it should make its truth, decision, and outcome boundaries more explicit.

## Re-verification commands

    rg --files "ERA Notes/01 - Architecture/Feature Map/standalone"
    git log --oneline --since="2026-07-02" -- "src/features/accounts/hooks.ts" "src/features/balance/hooks.ts" "src/lib/balance-utils.ts"

Re-run the relevant focused tests before moving any score.

