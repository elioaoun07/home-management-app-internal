---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Prerequisites
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Prerequisites · Checklist

> [FABLED+ root](<../../../_index.md>) · **Prerequisites** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Promote chosen work into owning campaign checklists; this study is not a second authority.

## Now

- [ ] **N1** — Locate and verify the evaluator implementation and all callers.
- [ ] **N2** — Add cycle, depth, race, and replay fixtures.
- [ ] **N3** — Define evidence source/time/expiry.

## Next

- [ ] **X1** — Render Why blocked and proof path.
- [ ] **X2** — Prototype one alternate path.
- [ ] **X3** — Contract-test concurrent NFC and manual satisfaction.

## Later

- [ ] **L1** — Measure false and late activations.
- [ ] **L2** — Calibrate expiry only from evidence.
- [ ] **L3** — Require graph proof for new prerequisite types.

## 10× bet validation

- [ ] **BET-1 · Dependency proof** — Run validator against current prerequisites and seeded cycles. **Pass:** Every dormant item has a finite explainable path or explicit impossible state. **Kill:** Keep validation to cycle/depth if richer proof has no cases.
- [ ] **BET-2 · Alternative evidence paths** — Model one prerequisite satisfiable by NFC or manual verified checklist. **Pass:** The real workflow no longer needs a bypass edit. **Kill:** Keep one path if alternatives confuse users.
- [ ] **BET-3 · Evidence trust ladder** — Compare NFC tap, checklist acknowledgement, and external event. **Pass:** A stale/weak proof cannot cause a surprise activation. **Kill:** Use source+time only if confidence levels are arbitrary.

## Definition of done

- [ ] Connected implementations re-verified.
- [ ] Smallest proof passed before expansion.
- [ ] Truth, time, partner, offline, cache, retry, privacy, and Undo are explicit.
- [ ] Contract/integration tests protect the bridge.
- [ ] A real outcome justifies keeping it.
- [ ] Normal PM files hold execution status.

