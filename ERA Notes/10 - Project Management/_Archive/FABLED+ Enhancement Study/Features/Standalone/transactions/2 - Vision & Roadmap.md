---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Transactions
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transactions · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Transactions** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make transaction capture progressively truthful: commit fast, preserve uncertainty, then graduate the record to reconciled truth with minimal follow-up.

## Product and business value

The transaction path is where daily retention is won. Reducing correction effort by even one interaction per day compounds more than another dashboard; lifecycle truth also raises confidence in every downstream analytic and AI answer.

Value should be measured in avoided corrections, prevented surprises, shorter decisions, safer shared action, or attention returned—not page visits.

## Roadmap

1. Now — instrument correction reasons and define a transaction truth-state model without migrating the database.
2. Next — let imported and manually captured entries carry confidence/provenance chips through review and reconciliation.
3. Later — use correction history to ask fewer questions at capture while keeping every learned default reversible.

## New opportunity set

### V1 — Progressive transaction truth

- **Mechanism:** Represent captured, reviewed, and reconciled states as a UI-layer envelope before any schema expansion.
- **Smallest proof:** Apply it only to statement-imported transactions and show state transitions in review.
- **Success measure:** Duplicate/correction rate falls while capture completion time does not rise.
- **Kill criterion:** Do not add persisted states if the envelope never changes user behavior.
- **Invariant:** State labels never change balance effects.

### V2 — Correction learning ledger

- **Mechanism:** Treat edits and Undo as labeled feedback about parsing, defaults, or merchant mapping rather than isolated mutations.
- **Smallest proof:** Capture correction reason locally for 50 edits and inspect the distribution.
- **Success measure:** One repeated correction class can be eliminated with a deterministic rule.
- **Kill criterion:** Stop if reasons are too sparse or burdensome to collect implicitly.
- **Invariant:** Learning can suggest defaults, never silently rewrite history.

### V3 — Capture uncertainty budget

- **Mechanism:** Auto-fill high-confidence fields and spend the user's attention only on the one field most likely to be wrong.
- **Smallest proof:** Score voice/import fixtures and ask a single micro-question below threshold.
- **Success measure:** Median capture taps fall without increasing 7-day corrections.
- **Kill criterion:** Revert if corrections rise by more than 5%.
- **Invariant:** Amounts and accounts require deterministic validation before commit.

## Relationship to existing plans

Merchant intelligence, universal ingestion, conversational split, and generic explainable money already exist in prior studies; this roadmap concentrates on transaction truth lifecycle and correction economics. These proposals complement the baseline rather than renaming its ideas.

## Strategic boundary

Do not add a second engine, bypass the proposal/draft pattern, weaken household visibility, or automate a state change before its shadow proof and inverse action are written.

