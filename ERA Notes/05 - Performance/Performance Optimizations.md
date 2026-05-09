---
created: 2026-03-23
type: performance
module: analytics
module-type: standalone
status: active
tags:
  - type/performance
  - module/analytics
---

# Performance Optimizations

> **Key files:** `src/app/dashboard/`, `src/features/transactions/useDashboardTransactions.ts`, `src/app/providers.tsx`
> **Status:** Active

## Dashboard Caching Strategy

Dashboard uses **client-side rendering with persistent TanStack Query cache** (no SSR).

### Cache config

```typescript
staleTime: 1000 * 60 * 5; // fresh for 5 minutes
gcTime: 1000 * 60 * 60 * 24; // kept for 24 hours
refetchOnMount: "always"; // background sync on mount
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
window.location.reload();

// ✅ CORRECT — React Query handles the update
queryClient.invalidateQueries({ queryKey: ["transactions"] });
```

### Non-blocking preferences load

```typescript
// ❌ WRONG — blocks UI rendering
await loadPreferences();
setIsInitialized(true);

// ✅ CORRECT — fire and forget, UI renders immediately with defaults
loadPreferences();
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

| Scenario                  | Before                | After                      |
| ------------------------- | --------------------- | -------------------------- |
| First load                | 2-3s (SSR + DB)       | 1-2s (client + skeleton)   |
| Cached load               | 2-3s (no cache)       | <100ms (instant)           |
| After editing transaction | Full page reload 2-3s | Instant React Query update |
| Navigation click          | Blocking white screen | Prefetched, instant        |

## Key Files

- `src/app/providers.tsx` — `STABLE_KEYS` list for localStorage persistence
- `src/app/dashboard/DashboardClientPage.tsx` — client-side dashboard with caching
- `src/features/transactions/useDashboardTransactions.ts` — optimal cache config
- `src/app/api/transactions/route.ts` — GET with date range, household links, `s-maxage=60`
- `src/features/dashboard/prefetchDashboard.ts` — prefetch utility
- `src/lib/hooks/usePerformance.ts` — deferred computation utilities

---

## RLS on Child Tables — Hard Constraint

> Learned from the May 2026 Schedule/Journal slowdown. Benchmark: 50 items, service role (no RLS) — `item_alerts` alone took **569ms** vs ~192ms for every other child, and total page latency was ~1.3s cold.

### The problem

When you enable RLS on a child table with a policy of this form:

```sql
-- ❌ CATASTROPHICALLY SLOW on hot tables
CREATE POLICY child_user_access ON public.item_alerts
  USING (EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = item_alerts.item_id
      AND i.user_id = auth.uid()
  ));
```

PostgreSQL evaluates the `EXISTS` join **for every row scanned**, even with indexes. For 50 rows across 6 child tables that gives 300 EXISTS-join evaluations per query — compounding into ~500ms+ per table.

### Solution A — SECURITY DEFINER RPC (preferred for hot paths)

Bundle the parent + all children into a single function that enforces ownership in its WHERE clause and bypasses per-table RLS:

```sql
CREATE OR REPLACE FUNCTION public.get_schedule_bundle(include_archived boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  -- ownership enforced here; children inherit via CTE JOIN
  WITH visible AS (SELECT * FROM items WHERE user_id = uid AND deleted_at IS NULL)
  SELECT jsonb_build_object('items', jsonb_agg(
    to_jsonb(v) || jsonb_build_object(
      'subtasks', (SELECT jsonb_agg(to_jsonb(s)) FROM item_subtasks s WHERE s.parent_item_id = v.id),
      -- ... other children
    )
  )) INTO result FROM visible v;
  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_schedule_bundle(boolean) TO authenticated;
-- Do NOT grant to public / anon unless intended.
```

See `migrations/2026-05-11_schedule_bundle_rpc.sql` for the full production version.

### Solution B — Denormalized `user_id` on child table

Add `user_id uuid NOT NULL` to the child table, backfill it from the parent, keep it in sync with a trigger, then write a direct policy:

```sql
ALTER TABLE public.item_alerts ADD COLUMN user_id uuid REFERENCES auth.users;
UPDATE public.item_alerts a SET user_id = (SELECT user_id FROM items WHERE id = a.item_id);

CREATE POLICY child_user_access ON public.item_alerts
  USING (user_id = auth.uid()); -- O(1) index scan, no JOIN
```

Use this when you need the child table to be accessible outside of the bundle RPC.

### Decision guide

| Scenario                                         | Approach                                     |
| ------------------------------------------------ | -------------------------------------------- |
| Hot read path (loaded on every page visit)       | SECURITY DEFINER RPC                         |
| Child accessed via many different parent queries | Denormalized `user_id`                       |
| Admin/cron operations                            | `supabaseAdmin()` (bypasses RLS entirely)    |
| Low-frequency child table                        | Either — but still never use EXISTS-subquery |

### Required indexes for every FK column on child tables

PostgREST and the planner both need these. Add them in every child-table migration:

```sql
CREATE INDEX IF NOT EXISTS idx_<child>_item_id ON public.<child> (item_id);
-- for subtasks:
CREATE INDEX IF NOT EXISTS idx_item_subtasks_parent_item_id ON public.item_subtasks (parent_item_id);
-- for exceptions:
CREATE INDEX IF NOT EXISTS idx_item_recurrence_exceptions_rule_id ON public.item_recurrence_exceptions (rule_id);
```

Missing FK indexes turn IN-list lookups into seq scans and are the most common cause of "why is this fast in dev but slow in prod with real data?".

---

## PostgREST Round-Trip Cost

Each Supabase `.from()` call is a separate HTTP request to PostgREST. Measured floor cost (Supabase hosted, Europe):

| Operation                        | Cost                           |
| -------------------------------- | ------------------------------ |
| Single PostgREST round-trip      | ~170–200 ms                    |
| 7 child-table queries (parallel) | ~600 ms (dominated by slowest) |
| 7 child-table queries (serial)   | ~1.4 s                         |
| 1 SECURITY DEFINER RPC bundle    | ~150–250 ms total              |

**Rule:** if a page load requires fetching a parent + ≥3 child tables, it must use an RPC bundle.
