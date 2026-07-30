---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Debts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Debts · Checklist

> [FABLED+ root](<../../../_index.md>) · **Debts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Study queue only. Promote chosen work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Define the debt timeline calculation and partial-settlement invariant.
- [ ] **N2** — Inventory current API behavior for retries and settlement edits.
- [ ] **N3** — Write neutral acknowledgement and dispute language.

## Next

- [ ] **X1** — Render the timeline on one detail surface.
- [ ] **X2** — Prototype deterministic settlement options without mutation.
- [ ] **X3** — Add shared acknowledgement only for household-linked users.

## Later

- [ ] **L1** — Measure disputes, corrections, and reminder dismissals.
- [ ] **L2** — Tune cadence from explicit preferences.
- [ ] **L3** — Export a dispute-proof receipt only if real use warrants it.

## 10× bet validation

- [ ] **BET-1 · Debt contract timeline** — Reconstruct two real debts with existing data plus local annotations. **Pass:** Both parties can explain the current balance and its history without external messages. **Kill:** Keep a simple note if amendment history never occurs.
- [ ] **BET-2 · Fairness-aware settlement menu** — Generate deterministic options for one debt using available balances and dates. **Pass:** One option is accepted without manual recomputation. **Kill:** Remove suggestions if they feel coercive or ignore real constraints.
- [ ] **BET-3 · Mutual acknowledgement receipt** — Prototype a two-person acknowledgement on one settlement. **Pass:** No follow-up clarification is needed for that settlement. **Kill:** Use single-party receipts for external counterparties.

## Definition of done

- [ ] Current implementation was re-verified.
- [ ] The smallest proof passed before schema/platform expansion.
- [ ] Truth, time, partner, offline, cache, retry, and Undo behavior are explicit.
- [ ] A focused test protects the invariant.
- [ ] A real outcome justifies keeping the capability.
- [ ] Normal PM files, not this study, hold execution status.

