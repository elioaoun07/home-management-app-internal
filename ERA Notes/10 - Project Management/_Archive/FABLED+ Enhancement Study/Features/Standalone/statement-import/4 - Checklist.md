---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Statement Import
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Statement Import · Checklist

> [FABLED+ root](<../../../_index.md>) · **Statement Import** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Study queue only. Promote chosen work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Complete the merchant-mapping focused tests in the active working tree.
- [ ] **N2** — Define statement total/date/row reconciliation fixtures.
- [ ] **N3** — Specify an idempotent import batch receipt before schema work.

## Next

- [ ] **X1** — Render the rehearsal diff from the exact commit rules.
- [ ] **X2** — Add source fingerprint/profile metadata to the parse response.
- [ ] **X3** — Contract-test replay, partial failure, and cents reconciliation.

## Later

- [ ] **L1** — Persist batch receipts only after the pure proof passes.
- [ ] **L2** — Measure corrections by parser profile and version.
- [ ] **L3** — Add rollback only when its ownership boundary is exact.

## 10× bet validation

- [ ] **BET-1 · Import rehearsal** — Run it against two real statements with seeded duplicates. **Pass:** The batch outcome is predictable to the row and cent before import. **Kill:** Keep only summary totals if row-level diff is too noisy.
- [ ] **BET-2 · Statement source fingerprint** — Fingerprint three existing files and a deliberately modified format. **Pass:** Format drift is detected before wrong rows reach review. **Kill:** Use manual profile selection if automatic identification is unreliable.
- [ ] **BET-3 · Batch reconciliation receipt** — Generate a receipt for one import and replay the request. **Pass:** Replay creates no duplicates and the receipt balances exactly. **Kill:** Do not build one-click rollback until batch identity and invariants are proven.

## Definition of done

- [ ] Current implementation was re-verified.
- [ ] The smallest proof passed before schema/platform expansion.
- [ ] Truth, time, partner, offline, cache, retry, and Undo behavior are explicit.
- [ ] A focused test protects the invariant.
- [ ] A real outcome justifies keeping the capability.
- [ ] Normal PM files, not this study, hold execution status.

