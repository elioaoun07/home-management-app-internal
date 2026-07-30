---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Sync & Offline
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Sync & Offline · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Sync & Offline** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one cross-module loop without creating a parallel engine or widening permissions.

## Now

- Reconcile 3/5/8-second timeout documentation and code ownership.
- Define operation and causal dependency fields.
- Choose top five offline mutation flows.

**Gate N:** deterministic/read-only proof with connected-module contracts listed.

## Next

- Journal and receipt one high-risk flow.
- Build conflict fixture preserving both versions.
- Add chaos replay for retry/reorder.

**Gate X:** vertical slice with provenance, both viewers, offline/retry, idempotency, and inverse.

## Later

- Expand only to flows with real failures.
- Measure duplicate actions and ambiguous pending states.
- Retire legacy queue only through verified migration.

**Gate L:** measured outcome earns scale; otherwise keep the proof or kill it.

## Mandatory preflight

- Read every connected standalone vault doc.
- Run Design Doctrine Ten Questions.
- Name auth, household scope, cache, time, retry identity, and Undo.
- Test the junction boundary, not only pure helpers.

## Non-goals

Generic event spine and cross-module Undo are prior ideas; this pack is specifically transport causality, conflict, and replay proof.

