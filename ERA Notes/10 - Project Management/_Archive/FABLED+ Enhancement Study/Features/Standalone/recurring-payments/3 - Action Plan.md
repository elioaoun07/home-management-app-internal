---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Recurring Payments
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recurring Payments · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Recurring Payments** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove the first closed-loop improvement for Recurring Payments without widening scope or changing trusted invariants prematurely.

## Now — evidence and smallest proof

- Add evidence-kind and variance fixtures to commitments tests.
- Map current mark-covered responses to the evidence ladder in UI only.
- Define exact semantics for partial, manual, and matched coverage.

**Gate N:** a deterministic fixture or read-only prototype demonstrates the claimed decision value; current behavior remains unchanged.

## Next — one vertical slice

- Prototype expected bands and material-drift thresholds.
- Add optional owner/acknowledger presentation for shared commitments.
- Contract-test retries and duplicate mark-covered requests.

**Gate X:** the slice works for both users where applicable, has explicit offline/degraded behavior, exposes provenance, and has a tested inverse or safe no-op.

## Later — earn scale

- Measure false reminders and manual coverage overrides.
- Persist evidence metadata only after the surface proves useful.
- Expose obligation confidence to notifications and ERA without delegating payment.

**Gate L:** real use changes the target outcome often enough to justify persistence, notifications, or wider integration. If not, keep the smaller tool or kill it.

## Required review before implementation

- Re-read the Feature Map and module vault docs.
- Run the Design Doctrine Ten Questions.
- Name query invalidations, household visibility, time semantics, idempotency key, and Undo/inverse.
- If money or recurrence is touched, invoke the matching risk playbook and add a worked invariant test.

## Explicit non-goals

Cashflow forecast, recurring↔schedule unification, subscription auditing, and Sunday money rituals are existing ideas; this pack targets evidence and assurance.

