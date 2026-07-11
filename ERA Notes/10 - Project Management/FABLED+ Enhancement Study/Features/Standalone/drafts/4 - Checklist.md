---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Drafts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Drafts · Checklist

> [FABLED+ root](<../../../_index.md>) · **Drafts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Study queue only. Promote chosen work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Define ProposalEnvelope fields: provenance, risk, preconditions, expiry, effects, inverse.
- [ ] **N2** — Choose one transaction draft for pure preview fixtures.
- [ ] **N3** — Record accept/edit/reject/expire/undo outcomes in tests.

## Next

- [ ] **X1** — Render a compact preview and stale-state message.
- [ ] **X2** — Make commit verify the same preconditions as preview.
- [ ] **X3** — Trial bilateral approval only on one joint high-impact case.

## Later

- [ ] **L1** — Measure proposal edit and regret rates.
- [ ] **L2** — Standardize the envelope across message actions and proactive cards.
- [ ] **L3** — Automate nothing solely because proposal acceptance is high.

## 10× bet validation

- [ ] **BET-1 · Counterfactual commit preview** — Implement a pure preview for one transaction draft. **Pass:** Users can predict the result and edit fewer confirmed drafts afterward. **Kill:** Use a compact summary if full diff adds review friction.
- [ ] **BET-2 · Proposal precondition lease** — Invalidate a category proposal after its category is removed or remapped. **Pass:** No stale proposal commits against changed source state. **Kill:** Limit leases to high-risk proposals if versioning every draft is excessive.
- [ ] **BET-3 · Bilateral approval state** — Prototype on one shared budget or purchase draft. **Pass:** The decision is auditable without forcing double approval on routine actions. **Kill:** Keep single-owner confirmation if shared use is rare.

## Definition of done

- [ ] Current implementation was re-verified.
- [ ] The smallest proof passed before schema/platform expansion.
- [ ] Truth, time, partner, offline, cache, retry, and Undo behavior are explicit.
- [ ] A focused test protects the invariant.
- [ ] A real outcome justifies keeping the capability.
- [ ] Normal PM files, not this study, hold execution status.

