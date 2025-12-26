# Real-Time Sync Architecture Improvements

## Overview

This document describes the comprehensive real-time synchronization improvements implemented to ensure seamless, reliable data sync between users, especially for shopping list interactions.

## Problem Statement

Users experienced delays and inconsistencies when:

- One user checks an item, the other user doesn't see it immediately
- Network conditions are poor or intermittent
- The app goes to background and returns
- WebSocket connections drop silently

## Solution Architecture

### 1. **SyncContext** - Global Sync State Management

**File:** `src/contexts/SyncContext.tsx`

Central context that manages:

- Connection status (`connected`, `connecting`, `reconnecting`, `offline`, `error`)
- Online/offline detection via browser APIs
- Pending operations queue for offline support
- Visibility change handling (refetch when returning from background)
- Global refresh capabilities

Key Features:

- Automatically detects when user goes online/offline
- Processes queued operations when connection is restored
- Tracks last sync time for UI feedback
- Provides `retryWithBackoff()` for reliable API calls

### 2. **SyncIndicator Component** - Visual Feedback

**File:** `src/components/ui/SyncIndicator.tsx`

Provides visual feedback for sync status:

- **Green checkmark:** Connected and synced
- **Spinning arrows:** Syncing/reconnecting
- **Yellow warning:** Connecting
- **Gray cloud:** Offline
- **Red alert:** Error

Also includes:

- `OfflineBanner` - Full-width banner for offline/error states
- `FloatingRefreshButton` - Mobile-friendly manual refresh

### 3. **Enhanced Real-time Subscriptions**

**File:** `src/features/hub/hooks.ts`

Improvements to `useRealtimeMessages`:

#### Reconnection with Exponential Backoff

```typescript
const scheduleReconnect = () => {
  const delay = Math.min(
    RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempt.current),
    RECONNECT_MAX_DELAY
  );
  // Retry after delay...
};
```

#### Fallback Polling

When WebSocket is down, falls back to polling every 10 seconds:

```typescript
fallbackPollInterval.current = setInterval(() => {
  queryClient.invalidateQueries({
    queryKey: ["hub", "messages", threadId],
    refetchType: "active",
  });
}, SYNC_CONSTANTS.FALLBACK_POLL_INTERVAL);
```

#### Visibility Change Handling

New hook `useVisibilityRefresh` refetches data when:

- User returns to tab after being away 30+ seconds
- App comes back from background on mobile

#### LocalStorage Cache Sync

Item check updates now also update localStorage:

```typescript
// Update localStorage cache for offline-first sync
const cacheKey = `hub-messages-${currentThreadId}`;
const cached = getStorageItem(cacheKey, null);
if (cached?.messages) {
  cached.messages = cached.messages.map((m) =>
    m.id === message_id ? { ...m, checked_at, checked_by } : m
  );
  setStorageItem(cacheKey, cached);
}
```

### 4. **Improved toggleCheck with Retry Logic**

**File:** `src/components/hub/ShoppingListView.tsx`

The `toggleCheck` function now:

1. Shows optimistic UI immediately (no delay)
2. Retries failed requests up to 3 times with exponential backoff
3. Shows clear error toast if all retries fail
4. Properly rolls back UI on failure

```typescript
const retryWithBackoff = async (
  operation: () => Promise<Response>,
  maxRetries = 3,
  onError?: () => void
): Promise<boolean> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await operation();
      if (res.ok) return true;
      // Retry logic...
    } catch {
      // Network error - retry...
    }
  }
  onError?.();
  return false;
};
```

### 5. **Query Configuration Updates**

**File:** `src/features/hub/hooks.ts`

- `staleTime` reduced from 60s to 30s for faster freshness
- `refetchOnWindowFocus: true` - now refetches when user returns
- `refetchOnReconnect: true` - refetches on network reconnect

## Integration Points

### Providers

**File:** `src/app/providers.tsx`

Added `SyncProvider` to wrap the app:

```tsx
<QueryClientProvider client={queryClient}>
  <SyncProvider>{/* ... other providers ... */}</SyncProvider>
</QueryClientProvider>
```

### HubPage

**File:** `src/components/hub/HubPage.tsx`

- Added `OfflineBanner` at top of page
- Added `SyncIndicator` in thread header
- Added `useVisibilityRefresh(threadId)` in ThreadConversation

### Dashboard

**File:** `src/components/dashboard/EnhancedMobileDashboard.tsx`

- Added compact `SyncIndicator` in filter row

## Constants

```typescript
const SYNC_CONSTANTS = {
  RECONNECT_BASE_DELAY: 1000, // Start with 1s retry delay
  RECONNECT_MAX_DELAY: 30000, // Max 30s between retries
  RECONNECT_MAX_ATTEMPTS: 10, // Try 10 times before giving up
  FALLBACK_POLL_INTERVAL: 10000, // Poll every 10s when realtime is down
  VISIBILITY_REFETCH_DELAY: 500, // Wait 500ms before refetching on visibility change
  CONNECTION_HEALTH_CHECK_INTERVAL: 15000, // Check connection every 15s
};
```

## User Experience Improvements

### Before

- Silent sync failures
- No indication of connection status
- Had to manually refresh or check/uncheck items multiple times
- No retry on network errors

### After

- Clear visual indicator of sync status
- Automatic reconnection when connection drops
- Automatic refetch when returning to app
- Retry logic with exponential backoff
- Offline queue for pending operations
- Manual refresh button when needed
- Toast notifications for failures

## Testing Scenarios

1. **Kill WiFi mid-session:** Should show offline banner, queue operations, sync when restored
2. **Background app for 5 minutes:** Should refetch on return
3. **Slow network:** Retry logic should handle timeouts
4. **Simultaneous edits:** Both users should see consistent state
5. **Tab switching:** Should refetch active data on focus

## Future Enhancements

1. **Service Worker sync:** Queue operations even after app closes
2. **Conflict resolution:** Smart merge when both users edit same item
3. **Delta sync:** Only fetch changed items, not full list
4. **WebSocket heartbeat:** Custom ping/pong for better dead connection detection
