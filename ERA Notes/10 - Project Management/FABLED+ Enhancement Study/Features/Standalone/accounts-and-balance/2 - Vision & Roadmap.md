---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Accounts & Balance
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Accounts & Balance · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Accounts & Balance** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Turn every balance from a naked number into an accountable household position: how fresh it is, why it moved, what is protected, and which decisions remain safe.

## Product and business value

Trust is the business value. Fewer manual reconciliations and fewer partner questions make the finance core indispensable; a confidence-aware balance layer is also a reusable foundation for forecasts, transfers, and ERA explanations.

Value should be measured in avoided corrections, prevented surprises, shorter decisions, safer shared action, or attention returned—not page visits.

## Roadmap

1. Now — add a read-only balance-confidence model in TypeScript and render it on one history surface without changing stored math.
2. Next — attach purpose and safety constraints to accounts (buffer, bills, daily spending) and make proposals respect them.
3. Later — close the loop by measuring whether accepted liquidity proposals reduced shortfalls without creating correction work.

## New opportunity set

### V1 — Balance confidence ribbon

- **Mechanism:** Combine last checkpoint, last mutation, offline queue state, and unresolved corrections into an honest freshness/confidence label.
- **Smallest proof:** Show the ribbon in Balance History for one account for two weeks.
- **Success measure:** At least 80% of balance questions are answered without opening raw transactions.
- **Kill criterion:** Remove the ribbon if it is ignored and never changes a decision.
- **Invariant:** It may describe confidence but never alter balance math.

### V2 — Protected liquidity corridors

- **Mechanism:** Let an account declare a safe lower/upper operating band and explain when a proposed move would cross it.
- **Smallest proof:** Add a local-only corridor to the primary wallet and simulate recent transfers.
- **Success measure:** The corridor catches at least one real near-shortfall or proves unnecessary after 30 days.
- **Kill criterion:** Keep it as a note if no decision changes in a month.
- **Invariant:** Crossing a corridor is advisory; no automatic money movement.

### V3 — Causal balance delta

- **Mechanism:** Group a selected period's movement into transactions, transfers, manual corrections, and pending work with source rows.
- **Smallest proof:** Build a pure selector over existing history and transaction fixtures.
- **Success measure:** A user can explain any 7-day delta in under 20 seconds.
- **Kill criterion:** Fold into history if it duplicates existing rows without reducing explanation time.
- **Invariant:** Every subtotal must reconcile exactly to the displayed delta.

## Relationship to existing plans

Cashflow forecasting, generic explainable-money drill-downs, and an event spine are already covered elsewhere; these bets focus on balance truth and operational safety. These proposals complement the baseline rather than renaming its ideas.

## Strategic boundary

Do not add a second engine, bypass the proposal/draft pattern, weaken household visibility, or automate a state change before its shadow proof and inverse action are written.

