# Offline Resilience — Implementation Plan

> **Constraint**: Background Sync API is NOT supported. This targets installed PWA on Android + A2HS on iOS.  
> **Strategy**: Foreground sync via IndexedDB queue + `online` event + visibility change.

---

## Bugfix Changelog (March 2026)

### Issue: API errors crash the app when going offline

**Root causes identified & fixed:**

1. **`refreshAll()` fires queries when offline** — `SyncContext.refreshAll()` called `invalidateQueries()` unconditionally, triggering refetches that fail with `TypeError: Failed to fetch`. Fixed by adding an `if (!navigator.onLine)` guard at the top of `refreshAll()`.

2. **`handleOnline` fires too eagerly** — Network reconnection triggers `processQueue` + `refreshAll` instantly, but the network may not be fully stable yet. Fixed with a 500ms `setTimeout` guard that rechecks `navigator.onLine` before firing.

3. **`useDashboardTransactions` refetches on mount/focus while offline** — Had `refetchOnMount: true` and `refetchOnWindowFocus: true` unconditionally. Fixed by making these offline-aware: `refetchOnMount: !isOffline`, `refetchOnWindowFocus: !isOffline`, and a custom `retry` function that returns `false` when offline.

4. **Balance queryFn throws when offline** — `AccountBalance` fetches from `/api/accounts/:id/balance` which fails offline. Fixed: the `queryFn` now detects offline state and returns localStorage-cached balance directly (no network call). Falls back to `getCachedBalance()` from `queryConfig.ts`.

5. **`prefetchAllTabs` fires when offline** — No guard existed. Added `if (!navigator.onLine) return;` at the top.

6. **Global React Query retry doesn't suppress "Offline" errors** — Added `error.message === "Offline"` check to the global retry function in `providers.tsx`. Also added `throwOnError: false` globally to prevent error boundaries from firing on stale offline errors.

### Issue: Cached data not loading correctly when opening app offline

**Root causes identified & fixed:**

1. **Service worker returns 504 for RSC payloads** — Next.js App Router uses RSC (React Server Components) payloads for client navigation (`/_next/` with `.rsc` or `?_rsc` params). The SW returned an empty 504 response which crashed the app. Fixed: RSC payloads now return `{}` with status 200 when offline, allowing the client app shell to render with persisted React Query cache.

2. **SW version bumped to 3.2.0** — Forces new SW install to pick up caching fixes.

### Issue: Default account step showing despite having a default

**Root causes identified & fixed:**

1. **Init fires before persisted cache restores** — `MobileExpenseForm` initializes when `!accountsLoading` but during `PersistQueryClientProvider` restore phase, accounts can be empty. Fixed: added guard `accounts.length > 0 || navigator.onLine` — when offline, waits for persisted data to actually load.

2. **No re-derivation when default account loads late** — If the persisted cache restores AFTER initial initialization, the step stays on "account" even though a default now exists. Fixed: added a `useEffect` that watches `defaultAccount` and jumps away from the "account" step when a default becomes available.

### Issue: Balance display not visually indicating offline state

**Fixed:**

- Balance text uses a greyed-out gradient (`from-white/30 to-white/20`) when offline instead of the colorful theme gradient
- Edit and Transfer buttons hidden when offline (network-only actions)
- "Cached" label shown next to WifiOff icon
- Pending offline transaction count shown prominently as amber text: "N pending offline transactions"
- Error state suppressed when offline and cached data exists — shows cached balance instead of "Setup Required"

### Issue: AI button not clearly indicating offline

**Fixed:**

- Reduced opacity from 50% to 35% when offline
- Background changed from `bg-gray-700/50` to `bg-slate-700/30` for a lighter, more washed-out look
- WifiOff icon opacity reduced from `text-white/40` to `text-white/20`

---

### Files Changed (Bugfix Round)

| File                                                    | Change                                                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/transactions/useDashboardTransactions.ts` | Offline-aware refetch/retry in `useDashboardTransactions`                                                                                      |
| `src/contexts/SyncContext.tsx`                          | Guard `refreshAll()` when offline; delay `handleOnline`; also invalidate `account-balance` on reconnect                                        |
| `src/components/expense/AccountBalance.tsx`             | Offline queryFn returns cached balance; grey balance text; hide edit/transfer; prominent pending count; suppress error when cached data exists |
| `src/features/navigation/prefetchTabs.ts`               | Skip all prefetches when offline                                                                                                               |
| `public/sw.js`                                          | v3.2.0; RSC payload fallback returns `{}` instead of 504                                                                                       |
| `src/app/providers.tsx`                                 | Global retry skips "Offline" errors; `throwOnError: false`                                                                                     |
| `src/components/expense/MobileExpenseForm.tsx`          | Wait for accounts data before init; re-derive step when default account loads late                                                             |
| `src/components/ai/AIChatAssistant.tsx`                 | Lighter grey styling when offline (opacity-35, slate-700/30)                                                                                   |

---

## Architecture Overview

```
User Action (offline)
  ↓
Mutation Hook intercepts (navigator.onLine === false)
  ↓
Save to IndexedDB "offline-queue" store
  ↓
Optimistic update in React Query cache
  ↓
Show pending indicator in UI
  ↓
...user comes back online / opens app...
  ↓
window "online" event  OR  document "visibilitychange"  OR  app mount
  ↓
OfflineSyncEngine reads IndexedDB queue
  ↓
Replays each operation sequentially (POST/PATCH/DELETE)
  ↓
On success → remove from IndexedDB → invalidate React Query cache
On failure (5xx) → increment retryCount, retry later
On failure (4xx) → remove from queue, show error toast
  ↓
UI indicator clears when queue is empty
```

---

## Scope — What Gets Queued

| Feature                            | Operations Queued                                  | API Target                              |
| ---------------------------------- | -------------------------------------------------- | --------------------------------------- |
| **Transactions**                   | Create, Update, Delete                             | `/api/transactions` (POST/PATCH/DELETE) |
| **Items (Reminders/Events/Tasks)** | Create, Update, Delete, Complete, Postpone, Cancel | Direct Supabase → wrap in API route     |
| **Hub Chat Messages**              | Send message                                       | `/api/hub/messages` (POST)              |
| **Subtasks**                       | Toggle, Add, Delete                                | Direct Supabase → wrap in API route     |
| **Recurring Payments**             | Confirm payment                                    | `/api/recurring` (POST)                 |

**NOT queued** (read-only or low-value offline):

- Account creation/deletion (rare, needs complex validation)
- Category changes (rare)
- Settings changes (use localStorage directly, already works)
- Voice messages (requires upload, too complex for offline)
- Thread creation (rare)

---

## Implementation Steps

### Step 1: IndexedDB Utility Layer

**File**: `src/lib/offlineQueue.ts`

Create a lightweight IndexedDB wrapper (no library — keep it small):

```
Database: "budget-offline"
Version: 1

Object Stores:
  "pending-ops" — { id, feature, operation, endpoint, method, body, tempId, createdAt, retryCount, maxRetries }
```

**API**:

```ts
// Core operations
openDB(): Promise<IDBDatabase>
addToQueue(op: OfflineOperation): Promise<string>     // returns ID
removeFromQueue(id: string): Promise<void>
getAllPending(): Promise<OfflineOperation[]>
clearQueue(): Promise<void>
getQueueCount(): Promise<number>
updateRetryCount(id: string, count: number): Promise<void>
```

**Types**:

```ts
interface OfflineOperation {
  id: string; // uuid
  feature: "transaction" | "item" | "hub-message" | "subtask" | "recurring";
  operation:
    | "create"
    | "update"
    | "delete"
    | "complete"
    | "postpone"
    | "cancel"
    | "confirm";
  endpoint: string; // API route path
  method: "POST" | "PATCH" | "DELETE";
  body: Record<string, unknown>; // serialized request body
  tempId?: string; // temporary client-side ID for optimistic updates
  createdAt: number; // Date.now()
  retryCount: number; // starts at 0
  maxRetries: number; // default 5
  metadata?: {
    // for UI display
    label: string; // "Add transaction $50.00"
    icon?: string; // feature icon
  };
}
```

**Size guard**: Max 200 pending operations. If exceeded, reject with toast "Too many pending changes. Please connect to sync."

---

### Step 2: Offline Sync Engine

**File**: `src/lib/offlineSyncEngine.ts`

Core sync processor that replays the queue:

```ts
class OfflineSyncEngine {
  private isSyncing: boolean = false;
  private listeners: Set<() => void> = new Set();

  // Process all pending operations sequentially
  async processQueue(): Promise<SyncResult>;

  // Subscribe to queue changes (for UI indicator)
  subscribe(listener: () => void): () => void;

  // Get current pending count (reactive)
  getPendingCount(): Promise<number>;
}
```

**Processing logic**:

1. Read all ops from IndexedDB sorted by `createdAt` (FIFO)
2. For each operation:
   - If `retryCount >= maxRetries` → remove from queue, notify user of permanent failure
   - Try `fetch(endpoint, { method, body })`
   - On **success (2xx)**: remove from IndexedDB, emit change event
   - On **client error (4xx)**: remove from queue (won't succeed), show toast with details
   - On **server error (5xx)**: increment `retryCount`, keep in queue, continue to next op
   - On **network error**: stop processing (still offline), keep everything in queue
3. After processing, emit change event so UI updates

**Conflict resolution**: Last-write-wins. Since we process FIFO and the server always has authority, if a transaction was modified offline and also modified by partner, the last sync wins. This is acceptable for this app.

**Guard**: Prevent concurrent processing with `isSyncing` lock.

---

### Step 3: Refactor SyncContext to Use IndexedDB

**File**: `src/contexts/SyncContext.tsx` — modify

**Changes**:

1. Replace `localStorage`-based `pendingOperations` state with IndexedDB-backed queue
2. Replace the shopping-list-only `processPendingOperations` with the generic `OfflineSyncEngine`
3. Add `pendingCount` state (reactive, from IndexedDB)
4. Add triggers:
   - `window.addEventListener("online", ...)` → already exists, enhance to call `syncEngine.processQueue()`
   - `document.addEventListener("visibilitychange", ...)` → already exists, enhance to call `syncEngine.processQueue()`
   - On mount (app opens) → call `syncEngine.processQueue()` if online
5. Keep existing Supabase Realtime health check logic unchanged
6. Add `queueOperation(op)` — public method to enqueue from mutation hooks

**New exports**:

```ts
interface SyncContextValue {
  // ... existing fields ...

  // Offline queue
  pendingCount: number; // reactive count
  pendingOperations: OfflineOperation[]; // for UI list display
  queueOperation: (op: QueueableOperation) => Promise<string>; // enqueue
  isProcessingQueue: boolean; // sync in progress
  lastSyncResult?: SyncResult; // last attempt result
}
```

---

### Step 4: Items API Route (New)

**File**: `src/app/api/items/route.ts` — create

Currently items mutations go directly to Supabase client. For offline queue, we need a consistent API route layer so the sync engine can replay HTTP requests.

Create a thin API route:

- `POST /api/items` — create item (reminder/event/task) with subtasks, alerts, recurrence
- `PATCH /api/items/[id]` — update item
- `DELETE /api/items/[id]` — delete/archive item
- `POST /api/items/[id]/complete` — complete item
- `POST /api/items/[id]/postpone` — postpone item

This wraps the same Supabase logic currently in `useItems.ts` hooks but as server-side API calls (using service role for reliability).

> **Why**: The sync engine replays `fetch()` calls. If items use direct Supabase client, we can't replay them from a single unified queue. API routes give us a consistent replay surface.

---

### Step 5: Wrap Mutation Hooks with Offline Awareness

For each mutation hook, add offline detection:

**Pattern** (example for `useAddTransaction`):

```ts
const { queueOperation, isOnline } = useSync()

// Inside mutationFn:
mutationFn: async (data) => {
  // If offline, queue instead of calling API
  if (!navigator.onLine) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await queueOperation({
      feature: "transaction",
      operation: "create",
      endpoint: "/api/transactions",
      method: "POST",
      body: { ...data },
      tempId,
      metadata: { label: `Add ${data.description || 'transaction'} $${data.amount}` }
    })
    // Return a fake response for optimistic update
    return { id: tempId, ...data, _offline: true }
  }

  // Normal online path (unchanged)
  const res = await fetch("/api/transactions", { ... })
  return res.json()
}
```

**Apply to**:

- `useAddTransaction` — queue create
- `useUpdateTransaction` — queue update
- `useDeleteTransaction` — queue delete
- `useCreateReminder` / `useCreateEvent` / `useCreateTask` — queue create via new API route
- `useUpdateItem` — queue update via new API route
- `useDeleteItem` — queue delete via new API route
- `useCompleteItem` / `usePostponeItem` / `useCancelItem` — queue action via new API route
- `useSendMessage` — queue message send
- `useToggleSubtask` / `useAddSubtask` / `useDeleteSubtask` — queue via new API route
- Recurring payment confirm — queue via existing API

**Optimistic updates remain unchanged** — the existing `onMutate` logic already handles cache updates. The only difference is the `mutationFn` queues instead of fetching when offline.

---

### Step 6: Post-Sync Cache Reconciliation

After each successful sync of a queued operation:

1. **Replace temp IDs**: If the operation was a "create" with a `tempId`, update React Query cache to replace `tempId` with the real server-assigned ID
2. **Invalidate related queries**: Call `queryClient.invalidateQueries` for the relevant keys (same keys as the original mutation's `onSettled`)
3. **Clear stale optimistic data**: The invalidation + refetch will bring fresh server data, overwriting any optimistic values

This happens inside `OfflineSyncEngine.processQueue()` via a callback:

```ts
onOperationSuccess(op: OfflineOperation, serverResponse: unknown) {
  // Replace tempId in cache if applicable
  if (op.tempId && op.feature === "transaction") {
    replaceTempIdInCache("transactions", op.tempId, serverResponse.id)
  }
  // Invalidate
  queryClient.invalidateQueries({ queryKey: getKeysForFeature(op.feature) })
}
```

**Query key map**:

```ts
const FEATURE_QUERY_KEYS = {
  transaction: [
    ["transactions"],
    ["transactions-today"],
    ["account-balance"],
    ["accounts"],
  ],
  item: [["items"]],
  "hub-message": [
    ["hub", "messages"],
    ["hub", "threads"],
  ],
  subtask: [["items"]],
  recurring: [["recurring-payments"], ["transactions"], ["account-balance"]],
};
```

---

### Step 7: App Shell Caching in Service Worker

**File**: `public/sw.js` — modify

Add **cache-first** strategy for the app shell only (HTML, CSS, JS bundles). This makes the PWA load instantly even without network.

```js
const CACHE_NAME = "app-shell-v1";
const SHELL_ASSETS = [
  "/", // HTML shell
  "/offline", // Offline fallback page
  "/appicon-192.png",
  "/appicon-512.png",
  "/manifest.json",
];
```

**Strategy**:

- `install` event: Pre-cache `SHELL_ASSETS`
- `fetch` event:
  - For **navigation requests** (HTML): Network-first with cache fallback. If network fails, serve cached `/` (the Next.js app shell which can render offline UI). If also not cached, serve `/offline` fallback.
  - For **static assets** (`/_next/static/`): Cache-first (immutable, fingerprinted filenames)
  - For **API requests** (`/api/`): Network-only (never cache API responses — data freshness is critical)
  - For **images/icons**: Stale-while-revalidate
- `activate` event: Clean up old cache versions

**Size limit**: Only cache app shell + static JS/CSS. Do NOT cache API responses or large assets. This keeps the cache under ~5MB.

---

### Step 8: Offline Fallback Page

**File**: `src/app/offline/page.tsx` — create

A lightweight page shown when the user navigates while fully offline and the page isn't cached:

- Shows app logo + "You're offline" message
- Shows pending operation count from IndexedDB
- "Retry" button that calls `location.reload()`
- Styled to match the app theme

This is a last resort — normally the cached app shell handles offline navigation fine.

---

### Step 9: UI — Pending Sync Indicator

**File**: `src/components/ui/SyncIndicator.tsx` — create

A non-intrusive indicator that shows when operations are pending:

**Placement**: Bottom of the screen, above the bottom nav bar (fixed position). Similar to WhatsApp's "Connecting..." bar.

**States**:

| State                        | Visual                                                   |
| ---------------------------- | -------------------------------------------------------- |
| **Online, no pending ops**   | Hidden (nothing shown)                                   |
| **Online, syncing**          | Subtle animated bar: "Syncing 3 changes..." with spinner |
| **Online, sync complete**    | Brief flash: "All changes synced ✓" → fades out after 2s |
| **Offline, no pending ops**  | Small pill: "Offline" in muted amber                     |
| **Offline, has pending ops** | Pill: "Offline · 5 pending" in amber, tappable to expand |
| **Sync error**               | Pill: "Sync failed · Tap to retry" in red/amber          |

**Expanded view** (tap the pill when offline with pending ops):

- Overlay/sheet showing list of pending operations with their labels
- Each item shows: icon + label + relative time ("2 min ago")
- "Clear All" button (with confirmation) to discard queue
- "Retry Now" button

**Animation**: Use Framer Motion for smooth entrance/exit.

---

### Step 10: Integrate SyncIndicator in Layout

**File**: `src/components/layouts/MobileLayout.tsx` (or wherever the bottom nav lives)

Add `<SyncIndicator />` just above the bottom navigation bar. It should be:

- Fixed position
- Z-index above content but below modals
- Not blocking tap targets on the nav bar

Also ensure the `SyncProvider` wraps the entire app (it likely already does based on the existing code).

---

### Step 11: Cleanup & Edge Cases

1. **Stale queue cleanup**: On app mount, remove any pending ops older than 24 hours (they're likely stale and would cause conflicts)

2. **Duplicate detection**: Before adding to queue, check if an identical operation already exists (same feature + operation + target ID). If so, replace (update case) or skip (create case).

3. **Delete after create**: If user creates a transaction offline, then deletes it offline (before sync), detect the matching `tempId` and remove both operations from the queue (net zero).

4. **Queue ordering**: Process in strict FIFO order. A "create" must sync before an "update" to the same entity.

5. **Auth token expiry**: If the user was offline for hours, the Supabase JWT may have expired. Before processing queue, check auth state and refresh token if needed.

6. **IndexedDB availability**: Some iOS private browsing modes limit IndexedDB. Fall back to in-memory queue (loses on app close, but still works during session).

7. **Max payload size**: Hub messages can be large (voice transcriptions). Cap at 64KB per operation body. If exceeded, don't queue — show toast "This action requires internet."

---

## File Checklist

| #   | File                                             | Action     | Description                                                    |
| --- | ------------------------------------------------ | ---------- | -------------------------------------------------------------- |
| 1   | `src/lib/offlineQueue.ts`                        | **Create** | IndexedDB wrapper for pending operations                       |
| 2   | `src/lib/offlineSyncEngine.ts`                   | **Create** | Queue processor with retry logic                               |
| 3   | `src/contexts/SyncContext.tsx`                   | **Modify** | Replace localStorage queue with IndexedDB, add engine triggers |
| 4   | `src/app/api/items/route.ts`                     | **Create** | API route for items (needed for queue replay)                  |
| 5   | `src/app/api/items/[id]/route.ts`                | **Create** | API route for single item operations                           |
| 6   | `src/app/api/items/[id]/actions/route.ts`        | **Create** | API route for complete/postpone/cancel                         |
| 7   | `src/app/api/subtasks/route.ts`                  | **Create** | API route for subtask mutations                                |
| 8   | `src/features/transactions/mutations.ts`         | **Modify** | Add offline queue path to mutationFn                           |
| 9   | `src/features/items/useItems.ts`                 | **Modify** | Add offline queue path to create/update/delete                 |
| 10  | `src/features/items/useItemActions.ts`           | **Modify** | Add offline queue path to complete/postpone/cancel             |
| 11  | `src/features/hub/hooks.ts`                      | **Modify** | Add offline queue path to useSendMessage                       |
| 12  | `src/features/recurring/useRecurringPayments.ts` | **Modify** | Add offline queue path to confirm                              |
| 13  | `public/sw.js`                                   | **Modify** | Add app shell caching strategy                                 |
| 14  | `src/app/offline/page.tsx`                       | **Create** | Offline fallback page                                          |
| 15  | `src/components/ui/SyncIndicator.tsx`            | **Create** | Pending sync indicator component                               |
| 16  | `src/components/layouts/MobileLayout.tsx`        | **Modify** | Add SyncIndicator to layout                                    |

---

## Testing Checklist

- [ ] Airplane mode → Add transaction → Goes to IndexedDB
- [ ] Re-enable network → Transaction syncs → Appears in DB
- [ ] Airplane mode → Create reminder → Re-enable → Syncs correctly
- [ ] Airplane mode → Send chat message → Shows as pending → Syncs on reconnect
- [ ] Kill app while offline with pending ops → Reopen → Queue persists → Syncs
- [ ] Add + Delete same transaction offline → Both cancel out, nothing sent
- [ ] 5xx server error → Operation stays in queue with incremented retry
- [ ] 4xx client error → Operation removed from queue, error toast shown
- [ ] Pending indicator shows correct count and labels
- [ ] Tapping indicator expands to show pending operations list
- [ ] App shell loads instantly when cached (no network)
- [ ] Navigate offline → App renders from cache, not blank screen
- [ ] iOS Safari A2HS → Same behavior as Android PWA
- [ ] IndexedDB fallback to memory queue in private browsing

---

## Order of Implementation

1. **Step 1** — IndexedDB utility (foundation)
2. **Step 2** — Sync engine (core logic)
3. **Step 7** — Service worker caching (independent, can be done early)
4. **Step 4** — Items API routes (prerequisite for Step 5)
5. **Step 3** — Refactor SyncContext (connects engine to app)
6. **Step 5** — Wrap mutation hooks (the main integration work)
7. **Step 6** — Post-sync cache reconciliation
8. **Step 9** — UI sync indicator
9. **Step 10** — Layout integration
10. **Step 8** — Offline fallback page
11. **Step 11** — Edge cases & cleanup
