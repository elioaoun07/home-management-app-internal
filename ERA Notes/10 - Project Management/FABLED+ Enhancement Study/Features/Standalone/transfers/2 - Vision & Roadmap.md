---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Transfers
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transfers · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Transfers** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Preserve transfer intent and prove paired effects, so every move is understandable before, during, and after commitment.

## Product and business value

Transfers are infrequent but disproportionately trust-sensitive. A provable receipt and safety preview protect the finance core and make embedded NFC/template flows safer to scale.

Value should be measured in avoided corrections, prevented surprises, shorter decisions, safer shared action, or attention returned—not page visits.

## Roadmap

1. Now — create a pure transfer receipt model with before/after balances and invariant checks.
2. Next — add optional purpose and safety preview using account truth envelopes.
3. Later — support expected reversal or review dates as reminders, not automatic money actions.

## New opportunity set

### V1 — Paired transfer receipt

- **Mechanism:** Render one immutable explanation containing operation ID, two deltas, before/after totals, visibility, and Undo outcome.
- **Smallest proof:** Generate receipts from existing API fixtures.
- **Success measure:** Every transfer reconciles to both account histories with zero manual arithmetic.
- **Kill criterion:** Keep a compact receipt if the expanded view is never opened.
- **Invariant:** The two balance effects must be atomic and sum to the expected account-type result.

### V2 — Intent-preserving transfer

- **Mechanism:** Attach a lightweight purpose and optional expected follow-up without creating a new transaction category.
- **Smallest proof:** Offer three purposes on NFC wallet refill and savings transfer.
- **Success measure:** A month later, users can identify why at least 90% of transfers occurred.
- **Kill criterion:** Drop structured purposes if free-text/none dominates.
- **Invariant:** Purpose never changes balance math.

### V3 — Liquidity safety preview

- **Mechanism:** Evaluate the transfer against source/destination corridors, pending mutations, and protected balances before confirmation.
- **Smallest proof:** Run shadow previews on the last 20 transfers.
- **Success measure:** The preview would have prevented or clarified at least one risky move.
- **Kill criterion:** Do not surface it if all previews are consistently neutral.
- **Invariant:** Advisory only; it cannot move or reserve funds.

## Relationship to existing plans

Generic envelope funding and broad cashflow simulation are already planned; these bets make the transfer itself auditable and purpose-aware. These proposals complement the baseline rather than renaming its ideas.

## Strategic boundary

Do not add a second engine, bypass the proposal/draft pattern, weaken household visibility, or automate a state change before its shadow proof and inverse action are written.

