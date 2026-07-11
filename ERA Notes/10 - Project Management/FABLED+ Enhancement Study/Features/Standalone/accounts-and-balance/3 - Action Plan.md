---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Accounts & Balance
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Accounts & Balance · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Accounts & Balance** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove the first closed-loop improvement for Accounts & Balance without widening scope or changing trusted invariants prematurely.

## Now — evidence and smallest proof

- Define BalanceTruth fields and derive them from existing cache/history state.
- Write fixtures for fresh, stale, pending-offline, and manually-corrected balances.
- Prototype the ribbon in the existing history drawer.

**Gate N:** a deterministic fixture or read-only prototype demonstrates the claimed decision value; current behavior remains unchanged.

## Next — one vertical slice

- Add optional account-purpose and corridor settings without changing account-type semantics.
- Build the pure causal-delta selector and reconcile it to existing balance tests.
- Test both viewers for public and private account states.

**Gate X:** the slice works for both users where applicable, has explicit offline/degraded behavior, exposes provenance, and has a tested inverse or safe no-op.

## Later — earn scale

- Measure reconciliation questions, manual corrections, and corridor warnings.
- Expose the truth envelope to ERA only after UI wording earns trust.
- Consider shared acknowledgement only for genuinely joint accounts.

**Gate L:** real use changes the target outcome often enough to justify persistence, notifications, or wider integration. If not, keep the smaller tool or kill it.

## Required review before implementation

- Re-read the Feature Map and module vault docs.
- Run the Design Doctrine Ten Questions.
- Name query invalidations, household visibility, time semantics, idempotency key, and Undo/inverse.
- If money or recurrence is touched, invoke the matching risk playbook and add a worked invariant test.

## Explicit non-goals

Cashflow forecasting, generic explainable-money drill-downs, and an event spine are already covered elsewhere; these bets focus on balance truth and operational safety.

