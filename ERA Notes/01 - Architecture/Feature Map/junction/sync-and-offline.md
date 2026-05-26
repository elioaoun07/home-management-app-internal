# Sync & Offline

**Type:** Junction
**Vault doc:** `ERA Notes/03 - Junction Modules/Sync & Offline/`

## What it does

When the network drops, mutations are queued locally and replayed when connectivity returns. New code uses an IndexedDB queue (`OfflineSyncEngine`); the only remaining legacy localStorage queue is the Hub Shopping List.

## Files at a glance

- **New code path (IndexedDB)**:
  - `src/lib/offlineQueue.ts` ← queue + engine
  - `src/lib/connectivityManager.ts` ← `isReallyOnline()`, `markOffline()`
  - `src/lib/safeFetch.ts` ← mutation wrapper that integrates with the queue
  - `src/lib/stores/offlinePendingStore.ts` ← Zustand store for pending UI
- **Legacy (localStorage; hub only)**:
  - `src/contexts/SyncContext.tsx`
- **UI**:
  - `src/app/offline/page.tsx`
  - `src/components/expense/OfflinePendingDrawer.tsx`
- **Context**: `SyncContext` (also exposes `useSyncSafe()`)

## Common edit scenarios

- **"Add a new queueable mutation"** → use `safeFetch()`. Failures (timeout / network) call `markOffline()`; the engine retries.
- **"Edit the offline indicator UI"** → wherever it's rendered — usually `MobileNav` or header. Check `src/components/layouts/MobileNav.tsx`.

## Gotchas

- **Never use `navigator.onLine`** (Hard Rule #7). Use `isReallyOnline()`.
- **Always pass `timeoutMs`** for long calls. Default is 3 s; AI / uploads / imports must override or they trip the offline flag falsely (Hard Rule #6).
- The legacy localStorage queue is **only** for shopping list — don't extend it. New offline work goes through IndexedDB.

## Connected modules

- Every module that mutates.
- Hub Shopping List (legacy queue lives here).
