---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Statement Import
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Statement Import · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Statement Import** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one closed-loop improvement without widening the trusted mutation boundary.

## Now

- Complete the merchant-mapping focused tests in the active working tree.
- Define statement total/date/row reconciliation fixtures.
- Specify an idempotent import batch receipt before schema work.

**Gate N:** deterministic fixtures or a read-only prototype demonstrate value with no behavior change.

## Next

- Render the rehearsal diff from the exact commit rules.
- Add source fingerprint/profile metadata to the parse response.
- Contract-test replay, partial failure, and cents reconciliation.

**Gate X:** one vertical slice works for both viewers where relevant and has provenance, degraded/offline behavior, idempotency, and inverse action.

## Later

- Persist batch receipts only after the pure proof passes.
- Measure corrections by parser profile and version.
- Add rollback only when its ownership boundary is exact.

**Gate L:** measured use changes the intended outcome often enough to justify scale; otherwise keep the smaller proof or kill it.

## Mandatory preflight

- Re-read Feature Map, module vault docs, and mutating routes.
- Run the Design Doctrine Ten Questions.
- Name cache invalidations, time semantics, household scope, retry identity, and Undo.
- Use money/recurrence playbooks where applicable.

## Non-goals

Universal ingestion and merchant intelligence are prior ideas; this pack concentrates on statement-level proof, parser drift, and batch safety.

