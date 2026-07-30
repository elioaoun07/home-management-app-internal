---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Accounts & Balance
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Accounts & Balance · Checklist

> [FABLED+ root](<../../../_index.md>) · **Accounts & Balance** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> This is a study queue, not a second PM authority. Promote selected work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Define BalanceTruth fields and derive them from existing cache/history state.
- [ ] **N2** — Write fixtures for fresh, stale, pending-offline, and manually-corrected balances.
- [ ] **N3** — Prototype the ribbon in the existing history drawer.

## Next

- [ ] **X1** — Add optional account-purpose and corridor settings without changing account-type semantics.
- [ ] **X2** — Build the pure causal-delta selector and reconcile it to existing balance tests.
- [ ] **X3** — Test both viewers for public and private account states.

## Later

- [ ] **L1** — Measure reconciliation questions, manual corrections, and corridor warnings.
- [ ] **L2** — Expose the truth envelope to ERA only after UI wording earns trust.
- [ ] **L3** — Consider shared acknowledgement only for genuinely joint accounts.

## 10× bet validation

- [ ] **BET-1 · Balance confidence ribbon** — Run: Show the ribbon in Balance History for one account for two weeks. **Pass:** At least 80% of balance questions are answered without opening raw transactions. **Kill:** Remove the ribbon if it is ignored and never changes a decision.
- [ ] **BET-2 · Protected liquidity corridors** — Run: Add a local-only corridor to the primary wallet and simulate recent transfers. **Pass:** The corridor catches at least one real near-shortfall or proves unnecessary after 30 days. **Kill:** Keep it as a note if no decision changes in a month.
- [ ] **BET-3 · Causal balance delta** — Run: Build a pure selector over existing history and transaction fixtures. **Pass:** A user can explain any 7-day delta in under 20 seconds. **Kill:** Fold into history if it duplicates existing rows without reducing explanation time.

## Definition of done

- [ ] The implementation claim is re-verified against current code.
- [ ] The smallest proof passes its binary gate before schema or platform expansion.
- [ ] Partner, offline, time, cache, idempotency, and Undo behavior are explicit.
- [ ] A focused test protects the new invariant or decision rule.
- [ ] The feature's normal PM files are updated; this study is not used as a duplicate execution queue.
- [ ] A measured outcome justifies keeping the capability after its trial window.

