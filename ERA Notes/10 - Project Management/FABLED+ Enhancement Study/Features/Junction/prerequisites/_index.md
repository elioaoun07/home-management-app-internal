---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Prerequisites
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Prerequisites · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Prerequisites** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A genuinely novel bridge between NFC and item activation, backed by dedicated tables and state transitions, but dependency correctness—cycles, alternative paths, evidence quality, and concurrent triggers—needs a formal graph contract.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 3/5 |
| **Decision** | 3/5 |
| **Action safety** | 3/5 |
| **Learning** | 1/5 |
| **Partnership** | 1/5 |
| **Total** | **15/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/junction/prerequisites.md`
- `ERA Notes/03 - Junction Modules/Prerequisites/Overview.md`
- `src/app/api/prerequisites`
- `src/lib/prerequisiteEvaluator.ts`
- `src/app/api/nfc`
- `migrations/schema.sql`
- `src/features/items/useItems.ts`

## Non-duplication boundary

Time-window and arrive-home triggers are existing roadmap items; this pack formalizes graph and evidence safety.

