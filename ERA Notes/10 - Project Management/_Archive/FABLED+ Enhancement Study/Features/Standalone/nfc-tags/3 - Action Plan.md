---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: NFC Tags
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# NFC Tags · Action Plan

> [FABLED+ root](<../../../_index.md>) · **NFC Tags** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one closed-loop improvement without widening trusted mutation boundaries.

## Now

- Enumerate action classes and their current idempotency behavior.
- Specify tap identity and dedupe windows.
- Design a receipt that includes exact inverse or safe no-op.

**Gate N:** deterministic fixture or read-only proof; no behavior change.

## Next

- Render receipts for material actions.
- Prototype one context-bound tag behind preview.
- Audit physical labels, placement, and last successful use.

**Gate X:** vertical slice with provenance, partner scope, offline behavior, retry identity, and inverse.

## Later

- Retire low-value tags visibly.
- Expand context only to proven repeated situations.
- Feed tag failures into error logs without exposing guest/partner data.

**Gate L:** measured outcome earns scale; otherwise keep the proof or kill it.

## Mandatory preflight

- Read Feature Map, vault docs, consumers, and mutating routes.
- Run Design Doctrine Ten Questions.
- Name cache, time, household, idempotency, and Undo behavior.

## Non-goals

House API, arrive-home triggers, and broad automation mining are prior ideas; this pack focuses on physical reliability and replay safety.

