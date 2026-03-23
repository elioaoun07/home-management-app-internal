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

## See Also

- [[Sync and Offline]]
- [[Common Patterns]]
