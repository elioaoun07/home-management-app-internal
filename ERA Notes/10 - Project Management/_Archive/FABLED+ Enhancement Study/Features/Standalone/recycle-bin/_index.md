---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Recycle Bin
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recycle Bin · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Recycle Bin** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A sound soft-delete and restore safety net, but deletion and restoration are row-centric while related actions, external sync, recurrence, and retention consequences can extend beyond the restored item.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 2/5 |
| **Decision** | 2/5 |
| **Action safety** | 4/5 |
| **Learning** | 1/5 |
| **Partnership** | 2/5 |
| **Total** | **15/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/recycle-bin.md`
- `ERA Notes/02 - Standalone Modules/Recycle Bin/Overview.md`
- `src/features/recycle-bin/hooks.ts`
- `src/app/recycle-bin/page.tsx`
- `src/app/api/recycle-bin/route.ts`
- `src/app/api/recycle-bin/restore/route.ts`
- `src/app/api/cron/purge-recycle-bin/route.ts`

## Non-duplication boundary

Generic cross-module Undo and event logging are existing ideas; this pack focuses on lifecycle, dependencies, and retention.

