# Performance Optimizations

> **Key files:** `src/app/dashboard/`, `src/features/transactions/useDashboardTransactions.ts`, `src/app/providers.tsx`
> **Status:** Active

## Dashboard Caching Strategy

Dashboard uses **client-side rendering with persistent TanStack Query cache** (no SSR).

### Cache config

```typescript
staleTime: 1000 * 60 * 5    // fresh for 5 minutes
gcTime: 1000 * 60 * 60 * 24 // kept for 24 hours
refetchOnMount: "always"     // background sync on mount
```

`transactions`, `dashboard-stats`, and `user-preferences` are in `STABLE_KEYS` → persisted to localStorage across page refreshes.

### Prefetch on navigation intent

`MobileNav` triggers prefetch on `onMouseEnter` + `onTouchStart` for the Dashboard link, so clicking feels instant.

### Cache invalidation triggers

Transactions cache is invalidated (triggering background refetch) after:
- Transaction created
- Transaction edited
- Transaction deleted
- Account balance updated

## Key Fixes Applied

### Never use `window.location.reload()`

```typescript
// ❌ WRONG — destroys all cache, causes 2-3s reload
window.location.reload()

// ✅ CORRECT — React Query handles the update
queryClient.invalidateQueries({ queryKey: ["transactions"] })
```

### Non-blocking preferences load

```typescript
// ❌ WRONG — blocks UI rendering
await loadPreferences()
setIsInitialized(true)

// ✅ CORRECT — fire and forget, UI renders immediately with defaults
loadPreferences()
```

### Show cached data instantly

```typescript
// Only show skeleton on truly first load (no data at all)
if (isLoading && transactions.length === 0) return <Skeleton />
return <Dashboard transactions={transactions} /> // renders instantly from cache
```

### React.memo for dashboard component

`EnhancedMobileDashboard` is wrapped in `React.memo` — only re-renders when props actually change.

## Performance Results

| Scenario | Before | After |
|---|---|---|
| First load | 2-3s (SSR + DB) | 1-2s (client + skeleton) |
| Cached load | 2-3s (no cache) | <100ms (instant) |
| After editing transaction | Full page reload 2-3s | Instant React Query update |
| Navigation click | Blocking white screen | Prefetched, instant |

## Key Files

- `src/app/providers.tsx` — `STABLE_KEYS` list for localStorage persistence
- `src/app/dashboard/DashboardClientPage.tsx` — client-side dashboard with caching
- `src/features/transactions/useDashboardTransactions.ts` — optimal cache config
- `src/app/api/transactions/route.ts` — GET with date range, household links, `s-maxage=60`
- `src/features/dashboard/prefetchDashboard.ts` — prefetch utility
- `src/lib/hooks/usePerformance.ts` — deferred computation utilities
