---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Categories
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Categories · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Categories** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove the first closed-loop improvement for Categories without widening scope or changing trusted invariants prematurely.

## Now — evidence and smallest proof

- Write a pure taxonomy-health analyzer and fixtures.
- Measure unused, deep, overlapping, and frequently corrected nodes.
- Verify cross-user slug behavior against current API semantics.

**Gate N:** a deterministic fixture or read-only prototype demonstrates the claimed decision value; current behavior remains unchanged.

## Next — one vertical slice

- Prototype optional intent tags in memory or front-end config.
- Test a seasonal ordering overlay without schema changes.
- Add merge preview with exact affected transaction counts.

**Gate X:** the slice works for both users where applicable, has explicit offline/degraded behavior, exposes provenance, and has a tested inverse or safe no-op.

## Later — earn scale

- Persist only metadata proven useful.
- Schedule a quarterly taxonomy review, not continuous nudges.
- Expose category health to statement import and ERA as advisory context.

**Gate L:** real use changes the target outcome often enough to justify persistence, notifications, or wider integration. If not, keep the smaller tool or kill it.

## Required review before implementation

- Re-read the Feature Map and module vault docs.
- Run the Design Doctrine Ten Questions.
- Name query invalidations, household visibility, time semantics, idempotency key, and Undo/inverse.
- If money or recurrence is touched, invoke the matching risk playbook and add a worked invariant test.

## Explicit non-goals

Merchant intelligence is covered elsewhere; this vision focuses on the quality and adaptability of the classification language itself.

