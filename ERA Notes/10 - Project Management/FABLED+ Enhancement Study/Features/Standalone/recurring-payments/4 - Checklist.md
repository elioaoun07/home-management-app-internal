---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Recurring Payments
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recurring Payments · Checklist

> [FABLED+ root](<../../../_index.md>) · **Recurring Payments** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> This is a study queue, not a second PM authority. Promote selected work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Add evidence-kind and variance fixtures to commitments tests.
- [ ] **N2** — Map current mark-covered responses to the evidence ladder in UI only.
- [ ] **N3** — Define exact semantics for partial, manual, and matched coverage.

## Next

- [ ] **X1** — Prototype expected bands and material-drift thresholds.
- [ ] **X2** — Add optional owner/acknowledger presentation for shared commitments.
- [ ] **X3** — Contract-test retries and duplicate mark-covered requests.

## Later

- [ ] **L1** — Measure false reminders and manual coverage overrides.
- [ ] **L2** — Persist evidence metadata only after the surface proves useful.
- [ ] **L3** — Expose obligation confidence to notifications and ERA without delegating payment.

## 10× bet validation

- [ ] **BET-1 · Coverage evidence ladder** — Run: Render the ladder for five real commitments without changing posting. **Pass:** Every covered item can be explained from one evidence source. **Kill:** Collapse back to covered/manual if extra levels do not affect decisions.
- [ ] **BET-2 · Obligation variance bands** — Run: Run a pure function over utilities, telecom, and fixed-rent fixtures. **Pass:** Variable bills produce fewer false anomalies while catching a seeded price jump. **Kill:** Use a manual range when history is too sparse.
- [ ] **BET-3 · Shared obligation handshake** — Run: Prototype acknowledgement states on one household bill. **Pass:** Ownership questions drop and no bill is falsely assumed handled. **Kill:** Keep single-owner semantics if both users do not use the handshake.

## Definition of done

- [ ] The implementation claim is re-verified against current code.
- [ ] The smallest proof passes its binary gate before schema or platform expansion.
- [ ] Partner, offline, time, cache, idempotency, and Undo behavior are explicit.
- [ ] A focused test protects the new invariant or decision rule.
- [ ] The feature's normal PM files are updated; this study is not used as a duplicate execution queue.
- [ ] A measured outcome justifies keeping the capability after its trial window.

