---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Sync & Offline
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Sync & Offline · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Sync & Offline** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A first-class connectivity layer with active probing, safeFetch, IndexedDB queue, pending indicators, and a sanctioned legacy queue, but users cannot yet inspect causal replay, conflicts, or a durable receipt proving what is local versus server-confirmed.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 5/5 |
| **Decision** | 2/5 |
| **Action safety** | 3/5 |
| **Learning** | 1/5 |
| **Partnership** | 2/5 |
| **Total** | **16/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/junction/sync-and-offline.md`
- `ERA Notes/03 - Junction Modules/Sync & Offline/Overview.md`
- `src/lib/safeFetch.ts`
- `src/lib/connectivityManager.ts`
- `src/lib/offlineQueue.ts`
- `src/contexts/SyncContext.tsx`
- `src/lib/stores/offlinePendingStore.ts`

## Non-duplication boundary

Generic event spine and cross-module Undo are prior ideas; this pack is specifically transport causality, conflict, and replay proof.

