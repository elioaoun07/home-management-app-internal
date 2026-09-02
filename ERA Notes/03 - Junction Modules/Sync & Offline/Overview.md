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

## See Also

- [[Sync and Offline]]
- [[Common Patterns]]
