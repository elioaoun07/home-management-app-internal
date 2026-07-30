---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Budget Allocation
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Budget Allocation · Checklist

> [FABLED+ root](<../../../_index.md>) · **Budget Allocation** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Study queue only. Promote chosen work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Write deterministic range fixtures for stable and volatile categories.
- [ ] **N2** — Record proposal provenance and confidence in the response model.
- [ ] **N3** — Choose one material allocation for a no-schema intent experiment.

## Next

- [ ] **X1** — Render range and evidence alongside the existing target.
- [ ] **X2** — Prototype shared acknowledgement through a review card.
- [ ] **X3** — Capture accepted, edited, ignored, and abandoned proposal outcomes.

## Later

- [ ] **L1** — Calibrate range width only after enough real outcomes exist.
- [ ] **L2** — Measure month-end decision time and post-save edits.
- [ ] **L3** — Expose allocation intent to ERA as context, never authority.

## 10× bet validation

- [ ] **BET-1 · Allocation confidence bands** — Calculate bands for five categories across six periods. **Pass:** Users change fewer targets after saving while still understanding the recommendation. **Kill:** Retain single targets if bands create ambiguity without reducing edits.
- [ ] **BET-2 · Intent-backed allocation** — Add intent locally to three categories and review at month end. **Pass:** The review can say whether each intent was served, not only whether money was under target. **Kill:** Remove structured intents if they are not reviewed.
- [ ] **BET-3 · Shared budget handshake** — Prototype one shared discretionary category. **Pass:** A budget change no longer requires an off-app clarification. **Kill:** Use single-owner configuration if both users do not participate.

## Definition of done

- [ ] Current implementation was re-verified.
- [ ] The smallest proof passed before schema/platform expansion.
- [ ] Truth, time, partner, offline, cache, retry, and Undo behavior are explicit.
- [ ] A focused test protects the invariant.
- [ ] A real outcome justifies keeping the capability.
- [ ] Normal PM files, not this study, hold execution status.

