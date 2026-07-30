---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Debts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Debts · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Debts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one closed-loop improvement without widening the trusted mutation boundary.

## Now

- Define the debt timeline calculation and partial-settlement invariant.
- Inventory current API behavior for retries and settlement edits.
- Write neutral acknowledgement and dispute language.

**Gate N:** deterministic fixtures or a read-only prototype demonstrate value with no behavior change.

## Next

- Render the timeline on one detail surface.
- Prototype deterministic settlement options without mutation.
- Add shared acknowledgement only for household-linked users.

**Gate X:** one vertical slice works for both viewers where relevant and has provenance, degraded/offline behavior, idempotency, and inverse action.

## Later

- Measure disputes, corrections, and reminder dismissals.
- Tune cadence from explicit preferences.
- Export a dispute-proof receipt only if real use warrants it.

**Gate L:** measured use changes the intended outcome often enough to justify scale; otherwise keep the smaller proof or kill it.

## Mandatory preflight

- Re-read Feature Map, module vault docs, and mutating routes.
- Run the Design Doctrine Ten Questions.
- Name cache invalidations, time semantics, household scope, retry identity, and Undo.
- Use money/recurrence playbooks where applicable.

## Non-goals

Debt→Schedule reminders are already proposed; this pack focuses on social contract, evidence, and fair resolution.

