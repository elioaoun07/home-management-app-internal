---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Drafts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Drafts · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Drafts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one closed-loop improvement without widening the trusted mutation boundary.

## Now

- Define ProposalEnvelope fields: provenance, risk, preconditions, expiry, effects, inverse.
- Choose one transaction draft for pure preview fixtures.
- Record accept/edit/reject/expire/undo outcomes in tests.

**Gate N:** deterministic fixtures or a read-only prototype demonstrate value with no behavior change.

## Next

- Render a compact preview and stale-state message.
- Make commit verify the same preconditions as preview.
- Trial bilateral approval only on one joint high-impact case.

**Gate X:** one vertical slice works for both viewers where relevant and has provenance, degraded/offline behavior, idempotency, and inverse action.

## Later

- Measure proposal edit and regret rates.
- Standardize the envelope across message actions and proactive cards.
- Automate nothing solely because proposal acceptance is high.

**Gate L:** measured use changes the intended outcome often enough to justify scale; otherwise keep the smaller proof or kill it.

## Mandatory preflight

- Re-read Feature Map, module vault docs, and mutating routes.
- Run the Design Doctrine Ten Questions.
- Name cache invalidations, time semantics, household scope, retry identity, and Undo.
- Use money/recurrence playbooks where applicable.

## Non-goals

Action-inbox convergence and generic proposal grammar are existing ideas; this pack specifies the deeper safety and consent contract behind them.

