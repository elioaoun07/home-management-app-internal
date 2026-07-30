---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Sync & Offline
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Sync & Offline · Feature State

> [FABLED+ root](<../../../_index.md>) · **Sync & Offline** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A first-class connectivity layer with active probing, safeFetch, IndexedDB queue, pending indicators, and a sanctioned legacy queue, but users cannot yet inspect causal replay, conflicts, or a durable receipt proving what is local versus server-confirmed.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/sync-and-offline.md`
- `ERA Notes/03 - Junction Modules/Sync & Offline/Overview.md`
- `src/lib/safeFetch.ts`
- `src/lib/connectivityManager.ts`
- `src/lib/offlineQueue.ts`
- `src/contexts/SyncContext.tsx`
- `src/lib/stores/offlinePendingStore.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Connectivity, requests, queue entries, retries, and pending counts are captured. |
| **Interpret** | Manager decides online/offline and queue processing. |
| **Propose** | Mostly automatic replay. |
| **Commit** | Mutations execute locally/optimistically and later server-side. |
| **Verify** | Per-operation local/queued/synced/conflicted receipt is inconsistent. |
| **Learn** | Failure/replay patterns do not systematically harden workflows. |

## Existing leverage

- Real connectivity probes reject navigator.onLine as sufficient truth.
- safeFetch centralizes timeout/offline transition and IndexedDB owns new queued work.
- Pending UI and action stores make local state visible in several surfaces.

## Feedback, friction, and risk

- The documented safeFetch default is 3 seconds, code uses 8 seconds, and its inline prose says 5—truth drift at the central mutation choke point.
- Causal ordering across related offline mutations can break when retries, deletes, and partner edits interleave.
- Conflict strategy is implicit or last-write-like for many entities; users lack a conflict inbox and original versions.

## Study conclusion

**Inference:** Make offline operation auditable and replayable: causal mutation journal, visible sync receipt, deterministic conflict policy, and chaos fixtures.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/lib/safeFetch.ts" "src/lib/connectivityManager.ts" "src/lib/offlineQueue.ts" "src/contexts/SyncContext.tsx"

Trace every connected standalone before implementation.

