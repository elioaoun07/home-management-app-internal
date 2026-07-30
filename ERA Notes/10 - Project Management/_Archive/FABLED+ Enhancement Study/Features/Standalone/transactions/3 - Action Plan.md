---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Transactions
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transactions · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Transactions** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove the first closed-loop improvement for Transactions without widening scope or changing trusted invariants prematurely.

## Now — evidence and smallest proof

- Define UI-only transaction provenance, confidence, and review-state types.
- Record anonymous correction categories in development fixtures.
- Extract one behavior seam from the mobile form only with a live capture improvement riding on it.

**Gate N:** a deterministic fixture or read-only prototype demonstrates the claimed decision value; current behavior remains unchanged.

## Next — one vertical slice

- Carry provenance from statement import and Hub drafts into review.
- Add a one-question uncertainty gate for low-confidence parses.
- Create contract fixtures for create → balance change → Undo → exact restore.

**Gate X:** the slice works for both users where applicable, has explicit offline/degraded behavior, exposes provenance, and has a tested inverse or safe no-op.

## Later — earn scale

- Persist only the truth states proven useful in the UI experiment.
- Use correction distributions to simplify form defaults.
- Publish capture-quality and correction-cost metrics to the module pack.

**Gate L:** real use changes the target outcome often enough to justify persistence, notifications, or wider integration. If not, keep the smaller tool or kill it.

## Required review before implementation

- Re-read the Feature Map and module vault docs.
- Run the Design Doctrine Ten Questions.
- Name query invalidations, household visibility, time semantics, idempotency key, and Undo/inverse.
- If money or recurrence is touched, invoke the matching risk playbook and add a worked invariant test.

## Explicit non-goals

Merchant intelligence, universal ingestion, conversational split, and generic explainable money already exist in prior studies; this roadmap concentrates on transaction truth lifecycle and correction economics.

