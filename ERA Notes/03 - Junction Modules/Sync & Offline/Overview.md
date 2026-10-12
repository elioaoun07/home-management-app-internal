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

## See Also

- [[Sync and Offline]]
- [[Common Patterns]]
