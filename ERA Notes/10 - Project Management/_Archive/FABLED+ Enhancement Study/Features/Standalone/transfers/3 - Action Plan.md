---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Transfers
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transfers · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Transfers** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove the first closed-loop improvement for Transfers without widening scope or changing trusted invariants prematurely.

## Now — evidence and smallest proof

- Write the pure paired-receipt calculation with worked before/after fixtures.
- Verify idempotency behavior for retry and offline replay.
- Inventory which transfer contexts can supply purpose automatically.

**Gate N:** a deterministic fixture or read-only prototype demonstrates the claimed decision value; current behavior remains unchanged.

## Next — one vertical slice

- Render the compact receipt after create and Undo.
- Prototype safety preview against one account corridor.
- Test public/private account combinations from both viewers.

**Gate X:** the slice works for both users where applicable, has explicit offline/degraded behavior, exposes provenance, and has a tested inverse or safe no-op.

## Later — earn scale

- Add optional review/reversal reminder proposals.
- Measure receipt opens, Undo, and reconciliation questions.
- Promote purpose fields only if they remain useful after 30 days.

**Gate L:** real use changes the target outcome often enough to justify persistence, notifications, or wider integration. If not, keep the smaller tool or kill it.

## Required review before implementation

- Re-read the Feature Map and module vault docs.
- Run the Design Doctrine Ten Questions.
- Name query invalidations, household visibility, time semantics, idempotency key, and Undo/inverse.
- If money or recurrence is touched, invoke the matching risk playbook and add a worked invariant test.

## Explicit non-goals

Generic envelope funding and broad cashflow simulation are already planned; these bets make the transfer itself auditable and purpose-aware.

