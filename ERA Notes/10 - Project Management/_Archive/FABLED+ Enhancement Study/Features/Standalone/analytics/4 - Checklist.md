---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Analytics
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Analytics · Checklist

> [FABLED+ root](<../../../_index.md>) · **Analytics** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Study queue only. Promote chosen work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Pick the two analytics that drive real decisions.
- [ ] **N2** — Define data coverage and provenance fields for them.
- [ ] **N3** — Prototype a local decision notebook entry and review flow.

## Next

- [ ] **X1** — Attach coverage UI to the chosen metrics.
- [ ] **X2** — Link one insight to an existing action proposal instead of adding inline mutation.
- [ ] **X3** — Record review outcomes and retire one low-value duplicate view.

## Later

- [ ] **L1** — Rank surfaces by decision value rather than visits.
- [ ] **L2** — Expand notebooks only if they are revisited.
- [ ] **L3** — Feed validated outcomes into future suggestions without claiming causality.

## 10× bet validation

- [ ] **BET-1 · Decision notebook** — Use it for three real money decisions. **Pass:** At review time the original reasoning can be reconstructed in under a minute. **Kill:** Use export/share instead if nobody revisits decisions.
- [ ] **BET-2 · Coverage map** — Add a confidence footer to monthly spend and net worth. **Pass:** Users can identify incomplete analyses before acting on them. **Kill:** Collapse to a warning badge if detailed coverage is never opened.
- [ ] **BET-3 · Decision impact attribution** — Track one dining guardrail and one savings decision. **Pass:** At least one review produces a useful keep/change/stop conclusion. **Kill:** Do not claim causality when the data only supports correlation.

## Definition of done

- [ ] Current implementation was re-verified.
- [ ] The smallest proof passed before schema/platform expansion.
- [ ] Truth, time, partner, offline, cache, retry, and Undo behavior are explicit.
- [ ] A focused test protects the invariant.
- [ ] A real outcome justifies keeping the capability.
- [ ] Normal PM files, not this study, hold execution status.

