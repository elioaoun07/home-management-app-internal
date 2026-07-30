---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Recycle Bin
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recycle Bin · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Recycle Bin** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one closed-loop improvement without widening trusted mutation boundaries.

## Now

- Map delete/restore/purge ownership by entity.
- Build restore-impact fixtures for recurring and synced items.
- Inventory current retention and external side effects.

**Gate N:** deterministic fixture or read-only proof; no behavior change.

## Next

- Render preview only when effects exist.
- Add retention policy documentation and one high-risk class.
- Record deletion reason without adding mandatory fields.

**Gate X:** vertical slice with provenance, partner scope, offline behavior, retry identity, and inverse.

## Later

- Measure restores and surprise effects.
- Tune flows that cause avoidable deletion.
- Emit final purge receipts for material data only.

**Gate L:** measured outcome earns scale; otherwise keep the proof or kill it.

## Mandatory preflight

- Read Feature Map, vault docs, consumers, and routes.
- Run Design Doctrine Ten Questions.
- Name cache, time, household, idempotency, privacy, and Undo behavior.

## Non-goals

Generic cross-module Undo and event logging are existing ideas; this pack focuses on lifecycle, dependencies, and retention.

