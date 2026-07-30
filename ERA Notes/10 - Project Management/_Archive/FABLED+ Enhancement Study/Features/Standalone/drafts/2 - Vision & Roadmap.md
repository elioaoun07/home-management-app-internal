---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Drafts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Drafts · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Drafts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Evolve drafts into a universal proposal contract: provenance, risk, preconditions, predicted effects, consent, expiry, receipt, and learning outcome.

## Business and household value

The proposal grammar is a reusable trust moat. A hardened contract lets the app add intelligence faster without spending user trust on every new feature.

The target is attention returned, errors prevented, decisions shortened, or conflict avoided—not engagement.

## Roadmap

1. Now — define a proposal envelope and risk/precondition checks in TypeScript.
2. Next — preview exact effects and invalidate stale proposals before confirmation.
3. Later — add bilateral approval only for high-impact shared decisions and learn from edits/rejections.

## New opportunity set

### V1 — Counterfactual commit preview

- **Mechanism:** Show exact records, balances, dates, notifications, and inverse action that confirmation would produce.
- **Smallest proof:** Implement a pure preview for one transaction draft.
- **Success measure:** Users can predict the result and edit fewer confirmed drafts afterward.
- **Kill criterion:** Use a compact summary if full diff adds review friction.
- **Invariant:** Preview and commit share validation; preview cannot mutate.

### V2 — Proposal precondition lease

- **Mechanism:** Attach source versions and expiry so a draft fails safely when relevant facts change.
- **Smallest proof:** Invalidate a category proposal after its category is removed or remapped.
- **Success measure:** No stale proposal commits against changed source state.
- **Kill criterion:** Limit leases to high-risk proposals if versioning every draft is excessive.
- **Invariant:** Expired/stale proposals ask for regeneration, never guess.

### V3 — Bilateral approval state

- **Mechanism:** Require explicit acknowledgement from both people only for configured joint-impact proposals.
- **Smallest proof:** Prototype on one shared budget or purchase draft.
- **Success measure:** The decision is auditable without forcing double approval on routine actions.
- **Kill criterion:** Keep single-owner confirmation if shared use is rare.
- **Invariant:** Silence, push delivery, or thread read never counts as approval.

## Existing-roadmap boundary

Action-inbox convergence and generic proposal grammar are existing ideas; this pack specifies the deeper safety and consent contract behind them.

## Strategy guardrail

Start read-only or in shadow mode. Persist and notify only after real use passes the named gate; never create a parallel engine for an existing concept.

