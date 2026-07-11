---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Transactions
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transactions · Checklist

> [FABLED+ root](<../../../_index.md>) · **Transactions** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> This is a study queue, not a second PM authority. Promote selected work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Define UI-only transaction provenance, confidence, and review-state types.
- [ ] **N2** — Record anonymous correction categories in development fixtures.
- [ ] **N3** — Extract one behavior seam from the mobile form only with a live capture improvement riding on it.

## Next

- [ ] **X1** — Carry provenance from statement import and Hub drafts into review.
- [ ] **X2** — Add a one-question uncertainty gate for low-confidence parses.
- [ ] **X3** — Create contract fixtures for create → balance change → Undo → exact restore.

## Later

- [ ] **L1** — Persist only the truth states proven useful in the UI experiment.
- [ ] **L2** — Use correction distributions to simplify form defaults.
- [ ] **L3** — Publish capture-quality and correction-cost metrics to the module pack.

## 10× bet validation

- [ ] **BET-1 · Progressive transaction truth** — Run: Apply it only to statement-imported transactions and show state transitions in review. **Pass:** Duplicate/correction rate falls while capture completion time does not rise. **Kill:** Do not add persisted states if the envelope never changes user behavior.
- [ ] **BET-2 · Correction learning ledger** — Run: Capture correction reason locally for 50 edits and inspect the distribution. **Pass:** One repeated correction class can be eliminated with a deterministic rule. **Kill:** Stop if reasons are too sparse or burdensome to collect implicitly.
- [ ] **BET-3 · Capture uncertainty budget** — Run: Score voice/import fixtures and ask a single micro-question below threshold. **Pass:** Median capture taps fall without increasing 7-day corrections. **Kill:** Revert if corrections rise by more than 5%.

## Definition of done

- [ ] The implementation claim is re-verified against current code.
- [ ] The smallest proof passes its binary gate before schema or platform expansion.
- [ ] Partner, offline, time, cache, idempotency, and Undo behavior are explicit.
- [ ] A focused test protects the new invariant or decision rule.
- [ ] The feature's normal PM files are updated; this study is not used as a duplicate execution queue.
- [ ] A measured outcome justifies keeping the capability after its trial window.

