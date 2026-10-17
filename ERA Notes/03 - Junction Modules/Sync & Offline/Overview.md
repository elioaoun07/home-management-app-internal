---
created: 2026-03-23
type: overview
module: sync-offline
module-type: junction
tags:
  - type/overview
  - module/sync-offline
---

# Sync & Offline

> **Source:** `src/contexts/SyncContext.tsx`, `src/lib/offlineQueue.ts`
> **Type:** Junction — connects ALL modules

## Docs in This Module

_See [[Sync and Offline]] in Architecture._

## Key Concepts

- IndexedDB queue via `src/lib/offlineQueue.ts` (new code)
- Legacy localStorage queue in `SyncContext` (hub shopping list only)
- FIFO replay with max 5 retries
- Use `isReallyOnline()` not `navigator.onLine`
- `safeFetch` distinguishes confirmed offline failures from request latency: timeouts trigger a de-duplicated health probe and never enter the mutation queue by themselves

### Unknown item creates — 2026-10-11 (SCH-24)

Item creates use the same prepared source request online/offline. Before replay, `reviewRequired` must commit in IndexedDB; a request-success event or memory fallback cannot acknowledge that durable fence. A complete source receipt removes the operation while still fenced. Explicit source rollback/not-started allows the normal retry policy; transport loss, unknown or legacy parent-only receipts hold the input, refresh Schedule and label Check Schedule. Held creates never replay automatically, expire at 24 hours or cancel through a create/delete pair. Inspect Schedule, then discard the local queued intent if appropriate. This is conservative duplicate prevention, not source idempotency or automatic reconciliation; HUB-46 owns those guarantees. Other features retain their existing queue behavior.

### Bulk item writes — 2026-10-17 (SCH-25)

`/api/items/bulk` operations (`feature: "item"`) are replay-safe because every item carries a client id, so they skip the review fence above: the engine replays them on a 30 s timeout, retries timeouts and 5xx like any operation, reports server-refused items once ("N not saved") and refreshes the item lists whenever it drops an operation, so optimistic rows never outlive it. A delete (`DELETE /api/items/bulk`) queues the same way. Undo of a create that is still queued rewrites or removes the queued operation (`removeQueuedItemCreates`) instead of sending a delete. Limits: queued rows are shown only in the session that created them, and a refetch before the queue syncs drops them from view; an Undo racing an operation already in flight can leave the item behind. Flow and tests: `src/features/items/bulkItems.ts`, `src/lib/OfflineSyncEngine.bulk.test.ts`; HUB-116 carries the pattern to the other multi-write flows and hardens the connectivity probe.

### Fitness workout writes — 2026-10-12 (HLTH-28)

`feature: "fitness"` ops (start, log/clear set, finish, reopen, delete/restore) are idempotent at the source: every write carries an op id with a durable receipt (`fitness_operations`). A 4xx replay (e.g. a set changed on another device) is held with `reviewRequired` and its input, and Fitness offers Keep mine / Discard; fitness ops are never removed by max retries or the 24-hour stale sweep. The Fitness page overlays queued ops on the persisted bundle (`src/lib/fitness/offline.ts`) and shows them as Pending.

## See Also

- [[Sync and Offline]]
- [[Common Patterns]]
