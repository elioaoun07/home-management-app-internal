# Sync & Offline Architecture

> **Key files:** `src/contexts/SyncContext.tsx`, `src/lib/offlineQueue.ts`, `src/lib/offlineSyncEngine.ts`, `public/sw.js`
> **Status:** Active (bugfixes applied March 2026)

## Overview

The app uses a **foreground sync** strategy (not Background Sync API — unsupported). When offline, mutations are queued in IndexedDB. On reconnect or app foreground, the sync engine replays queued operations sequentially.

## Architecture

```
User Action (offline)
  ↓
Mutation Hook → navigator.onLine === false
  ↓
Queue operation in IndexedDB ("budget-offline" DB, "pending-ops" store)
  ↓
Optimistic update in React Query cache
  ↓
window "online" | document "visibilitychange" | app mount
  ↓
OfflineSyncEngine reads IndexedDB queue (FIFO)
  ↓
Replay each operation (POST/PATCH/DELETE to API)
  ↓
Success → remove from queue, invalidate React Query cache
5xx → increment retryCount, keep in queue (max 5 retries)
4xx → remove from queue, show error toast
```

## SyncContext

**File:** `src/contexts/SyncContext.tsx`

Central context managing:
- Connection status: `connected` | `connecting` | `reconnecting` | `offline` | `error`
- Online/offline detection via `navigator.onLine` + browser events
- `refreshAll()` — guarded with `if (!navigator.onLine) return` to prevent crash-on-offline
- `handleOnline` fires with 500ms delay + re-checks `navigator.onLine` before processing (network may not be stable yet)
- `queueOperation(op)` — public method for mutation hooks to enqueue
- `pendingCount` — reactive IndexedDB queue count

**Provider:** Wraps app in `src/app/providers.tsx`:
```tsx
<QueryClientProvider>
  <SyncProvider>{...}</SyncProvider>
</QueryClientProvider>
```

## Offline Queue

**File:** `src/lib/offlineQueue.ts`

IndexedDB wrapper — no external library. Database: `"budget-offline"`, store: `"pending-ops"`.

Each operation:
```typescript
{
  id: string          // uuid
  feature: "transaction" | "item" | "hub-message" | "subtask" | "recurring"
  operation: "create" | "update" | "delete" | "complete" | "postpone" | "cancel" | "confirm"
  endpoint: string    // API route path
  method: "POST" | "PATCH" | "DELETE"
  body: Record<string, unknown>
  tempId?: string     // client-side ID for optimistic updates
  retryCount: number  // starts at 0
  maxRetries: number  // default 5
  metadata?: { label: string } // for UI display
}
```

Max 200 pending operations. Stale ops older than 24h are purged on mount.

## What Gets Queued

| Feature | Operations |
|---|---|
| Transactions | create, update, delete |
| Items / Reminders / Tasks | create, update, delete, complete, postpone, cancel |
| Hub Chat Messages | send |
| Subtasks | toggle, add, delete |
| Recurring Payments | confirm |

**NOT queued:** account creation, category changes, settings, voice messages (too complex), thread creation.

## Real-time Sync (Supabase Realtime)

**File:** `src/features/hub/hooks.ts` — `useRealtimeMessages`

- WebSocket reconnection with exponential backoff (base 1s, max 30s, max 10 attempts)
- Fallback polling every 10s when WebSocket is down
- `useVisibilityRefresh` hook: refetches after 30s of backgrounding
- `staleTime: 30s`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`

## Service Worker Caching (`public/sw.js`)

Current version: **3.2.0**

| Request type | Strategy |
|---|---|
| Navigation (HTML) | Network-first, fallback to cached shell, then `/offline` page |
| Static assets (`/_next/static/`) | Cache-first (immutable, fingerprinted) |
| API requests (`/api/`) | Network-only (never cache) |
| Images/icons | Stale-while-revalidate |
| RSC payloads (`?_rsc`, `.rsc`) | Returns `{}` with status 200 when offline (prevents app crash) |

## UI Components

- `src/components/ui/SyncIndicator.tsx` — status indicator (green/spinning/amber/red)
- `src/components/ui/SyncIndicator.tsx#OfflineBanner` — full-width offline banner
- `src/components/expense/AccountBalance.tsx` — offline: grey gradient, hides edit/transfer, shows pending count

## Offline-Aware Query Config

Critical fixes applied (March 2026):

- `useDashboardTransactions`: `refetchOnMount: !isOffline`, `refetchOnWindowFocus: !isOffline`, retry returns `false` when offline
- `AccountBalance` queryFn: detects offline, returns `getCachedBalance()` from localStorage instead of calling API
- `prefetchAllTabs`: guarded with `if (!navigator.onLine) return`
- Global React Query retry: skips `"Offline"` errors; `throwOnError: false` globally
- `MobileExpenseForm`: waits for `accounts.length > 0 || navigator.onLine` before initializing (prevents blank account step while cache restores)

## Gotchas

- Delete-after-create: if user creates then deletes the same entity offline, both ops cancel out (detected by `tempId`)
- Auth token may expire after long offline period — sync engine checks and refreshes token before processing queue
- iOS private browsing limits IndexedDB — falls back to in-memory queue (lost on app close but works during session)
- Hub message bodies capped at 64KB for queue; larger payloads require internet
