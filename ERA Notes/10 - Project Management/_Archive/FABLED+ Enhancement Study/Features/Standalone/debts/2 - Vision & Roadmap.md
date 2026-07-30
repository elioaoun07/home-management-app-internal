---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Debts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Debts · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Debts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make debts a respectful social contract with an auditable money trail, not merely an amount attached to a name.

## Business and household value

The value is conflict avoided. A trustworthy debt contract reduces awkward conversations and prevents duplicate or forgotten settlement, a meaningful household benefit disproportionate to module size.

The target is attention returned, errors prevented, decisions shortened, or conflict avoided—not engagement.

## Roadmap

1. Now — model a read-only contract timeline from existing debt and settlement data.
2. Next — add acknowledgement and partial-settlement proposals for household debts.
3. Later — calibrate reminder timing and settlement options from explicit feedback, not pressure.

## New opportunity set

### V1 — Debt contract timeline

- **Mechanism:** Present origin, agreed terms, amendments, partial settlements, and evidence as an append-only narrative.
- **Smallest proof:** Reconstruct two real debts with existing data plus local annotations.
- **Success measure:** Both parties can explain the current balance and its history without external messages.
- **Kill criterion:** Keep a simple note if amendment history never occurs.
- **Invariant:** Timeline totals must reconcile exactly to the canonical debt balance.

### V2 — Fairness-aware settlement menu

- **Mechanism:** Offer several cashflow-safe plans with trade-offs, leaving the debtor to choose.
- **Smallest proof:** Generate deterministic options for one debt using available balances and dates.
- **Success measure:** One option is accepted without manual recomputation.
- **Kill criterion:** Remove suggestions if they feel coercive or ignore real constraints.
- **Invariant:** Suggestions never change due dates or move money.

### V3 — Mutual acknowledgement receipt

- **Mechanism:** For shared debts, record that both people saw and accepted a settlement or dispute state.
- **Smallest proof:** Prototype a two-person acknowledgement on one settlement.
- **Success measure:** No follow-up clarification is needed for that settlement.
- **Kill criterion:** Use single-party receipts for external counterparties.
- **Invariant:** Lack of response cannot mark a debt settled.

## Existing-roadmap boundary

Debt→Schedule reminders are already proposed; this pack focuses on social contract, evidence, and fair resolution.

## Strategy guardrail

Start read-only or in shadow mode. Persist and notify only after real use passes the named gate; never create a parallel engine for an existing concept.

