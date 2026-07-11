---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Analytics
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Analytics · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Analytics** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one closed-loop improvement without widening the trusted mutation boundary.

## Now

- Pick the two analytics that drive real decisions.
- Define data coverage and provenance fields for them.
- Prototype a local decision notebook entry and review flow.

**Gate N:** deterministic fixtures or a read-only prototype demonstrate value with no behavior change.

## Next

- Attach coverage UI to the chosen metrics.
- Link one insight to an existing action proposal instead of adding inline mutation.
- Record review outcomes and retire one low-value duplicate view.

**Gate X:** one vertical slice works for both viewers where relevant and has provenance, degraded/offline behavior, idempotency, and inverse action.

## Later

- Rank surfaces by decision value rather than visits.
- Expand notebooks only if they are revisited.
- Feed validated outcomes into future suggestions without claiming causality.

**Gate L:** measured use changes the intended outcome often enough to justify scale; otherwise keep the smaller proof or kill it.

## Mandatory preflight

- Re-read Feature Map, module vault docs, and mutating routes.
- Run the Design Doctrine Ten Questions.
- Name cache invalidations, time semantics, household scope, retry identity, and Undo.
- Use money/recurrence playbooks where applicable.

## Non-goals

Cashflow simulator, annual Wrapped, generic AI reports, and anomaly alerts are existing ideas; this vision focuses on evidence quality and post-decision learning.

