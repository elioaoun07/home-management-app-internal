---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Prerequisites
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Prerequisites · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Prerequisites** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one cross-module loop without creating a parallel engine or widening permissions.

## Now

- Locate and verify the evaluator implementation and all callers.
- Add cycle, depth, race, and replay fixtures.
- Define evidence source/time/expiry.

**Gate N:** deterministic/read-only proof with connected-module contracts listed.

## Next

- Render Why blocked and proof path.
- Prototype one alternate path.
- Contract-test concurrent NFC and manual satisfaction.

**Gate X:** vertical slice with provenance, both viewers, offline/retry, idempotency, and inverse.

## Later

- Measure false and late activations.
- Calibrate expiry only from evidence.
- Require graph proof for new prerequisite types.

**Gate L:** measured outcome earns scale; otherwise keep the proof or kill it.

## Mandatory preflight

- Read every connected standalone vault doc.
- Run Design Doctrine Ten Questions.
- Name auth, household scope, cache, time, retry identity, and Undo.
- Test the junction boundary, not only pure helpers.

## Non-goals

Time-window and arrive-home triggers are existing roadmap items; this pack formalizes graph and evidence safety.

