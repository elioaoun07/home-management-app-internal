---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: NFC Tags
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# NFC Tags · Checklist

> [FABLED+ root](<../../../_index.md>) · **NFC Tags** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Promote chosen work into the owning campaign checklist; this study is not a second authority.

## Now

- [ ] **N1** — Enumerate action classes and their current idempotency behavior.
- [ ] **N2** — Specify tap identity and dedupe windows.
- [ ] **N3** — Design a receipt that includes exact inverse or safe no-op.

## Next

- [ ] **X1** — Render receipts for material actions.
- [ ] **X2** — Prototype one context-bound tag behind preview.
- [ ] **X3** — Audit physical labels, placement, and last successful use.

## Later

- [ ] **L1** — Retire low-value tags visibly.
- [ ] **L2** — Expand context only to proven repeated situations.
- [ ] **L3** — Feed tag failures into error logs without exposing guest/partner data.

## 10× bet validation

- [ ] **BET-1 · Tap receipt** — Implement read-only receipts for three existing tag types. **Pass:** Repeated taps are explainable and produce no duplicate effects. **Kill:** Use silent success for pure navigation tags.
- [ ] **BET-2 · Context-bound tag** — Use one tag with home/trip or mine/shared profiles. **Pass:** One physical tag replaces duplicate placement without surprising action. **Kill:** Keep one-tag-one-action if preview adds friction.
- [ ] **BET-3 · Physical utility audit** — Review all deployed tags after four weeks. **Pass:** At least one tag is moved, relabeled, or retired based on evidence. **Kill:** Use manual audit if telemetry is too sparse.

## Definition of done

- [ ] Current implementation re-verified.
- [ ] Smallest proof passed before expansion.
- [ ] Truth, time, partner, offline, cache, retry, and Undo are explicit.
- [ ] Focused tests protect the invariant.
- [ ] A real outcome justifies keeping it.
- [ ] Normal PM files hold execution status.

