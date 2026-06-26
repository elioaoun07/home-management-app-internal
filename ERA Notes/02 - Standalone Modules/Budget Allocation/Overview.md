---
created: 2026-03-23
type: overview
module: budget
module-type: standalone
tags:
  - type/overview
  - module/budget
---

# Budget Allocation

> **Source:** `src/features/budget/`
> **Type:** Standalone

## Key Files

| File                                      | Purpose                                       |
| ----------------------------------------- | --------------------------------------------- |
| `src/features/budget/hooks.ts`            | Query + mutation hooks (optimistic updates, Apply-All) |
| `src/components/web/WebBudget.tsx`        | Full-page UI — **Allocate** (input) / **Review** (viewing) |
| `src/app/api/budget-allocations/route.ts` | GET/POST/DELETE API (upsert by composite key) |
| `src/app/api/budget-allocations/ai-suggest/route.ts` | AI suggestion: outlier-clean history → Gemini → fallback |
| `src/lib/budget/budgetForecast.ts`        | Outlier-clean aggregation + statistical fallback + clamp (unit-tested) |
| `src/types/budgetAllocation.ts`           | All budget-related TypeScript types           |

## Query & Cache Architecture

- **Query key:** `["budget-allocations", month?, accountId?]` (inline — not in `qk.*` factory)
- **staleTime:** 5 minutes
- **refetchOnMount:** `"always"` — overrides global `false` to ensure fresh data on every page visit
- **Not persisted to localStorage** — `"budget-allocations"` is NOT in `STABLE_KEYS` (`providers.tsx`)
- **gcTime:** 24 hours (global default)

## Mutation Pattern (Optimistic)

`useSaveBudgetAllocation` uses the full optimistic + reconcile pattern:

```
onMutate  → cancelQueries (stop stale refetches) → snapshot → optimistic setQueriesData
onError   → rollback from snapshot
onSuccess → toast with Undo
onSettled → invalidateQueries (always reconcile with server)
```

### Why This Pattern Is Required

Without it, budget edits appear to "not save" due to three interacting cache layers:

1. **Stale refetch races** — Rapid budget changes (especially subcategory slider drags) fire multiple mutations. Without `cancelQueries`, an in-flight `GET` refetch from mutation N can complete _after_ mutation N+1's `POST`, writing stale data over the cache.

2. **`refetchOnMount: false` (global)** — Once stale data lands in the React Query in-memory cache, navigating away and back serves that stale data forever. The global `refetchOnMount: false` + `gcTime: 24h` means the query never automatically refreshes on re-navigation.

3. **localStorage red herring** — `localStorage.removeItem('hm-rq-cache-v3')` has zero effect because budget allocations aren't in `STABLE_KEYS` and are never persisted. The stale data lives purely in React Query's in-memory cache.

**Fix applied (2026-04-06):** Added `cancelQueries` → optimistic `setQueriesData` → `onSettled` invalidation pattern, plus `refetchOnMount: "always"` on the query itself.

## AI Budget Suggestions (outlier-aware, always-on)

> **Source:** `src/app/api/budget-allocations/ai-suggest/route.ts` + `src/lib/budget/budgetForecast.ts`

The Allocate surface shows AI proposals **inline** per category (suggested value
+ reasoning + a status chip: _Matches AI / +$ vs AI / -$ vs AI / Not set_), with
a per-row **Apply** and a top-bar **Apply all**. Manual values always win — AI is
a non-destructive suggestion layer. Read-only health + the AI plan summary live
on the **Review** surface (the old standalone "AI View" tab was removed).

**Generation pipeline (POST):**

1. Pull 12 months of expense transactions (`id, amount, category_id, subcategory_id, date, description`) + active `recurring_payments`.
2. `aggregateCleanMonthlyByCategory` runs `detectTransactionOutliers` (with the recurring payments as `recurringHints`) and **excludes** flagged one-off spikes / rare charges from the per-category monthly history — so a single large purchase can't inflate a category's baseline.
3. If `GEMINI_API_KEY` is set, the cleaned history is sent to Gemini; the parsed result is then **soft-clamped** (`softClampSuggestions`) to no more than 2.5x each category's typical (median) monthly spend — novel categories with no history are left untouched.
4. If Gemini is missing / errors / returns unparseable JSON, `buildStatisticalSuggestion` produces a deterministic median-based plan instead — **a suggestion is always returned** (never a 5xx for "AI not configured").
5. The plan total is clamped to the wallet balance, then stored in `ai_budget_suggestions` with `summary`, `generation_method` (`'ai' | 'estimate'`), and `excluded_outlier_count`. The UI shows an **AI / Estimate** badge + excluded-count.

**Hard rules honored here:** no `console.*` in the route; `safeFetch` with `timeoutMs: 60_000` on the client mutation; `409` on `23505`; the reasoning text renders inline (no glass floating panel).

**DB:** `migrations/2026-06-26_budget_ai_suggestion_meta.sql` adds `summary` / `generation_method` / `excluded_outlier_count` to `ai_budget_suggestions`.

## Gotchas

- The POST API uses `supabase.upsert()` with `onConflict: "user_id,category_id,subcategory_id,assigned_to,budget_month"`. This requires a matching unique index in the DB. If the index doesn't exist, upsert silently inserts duplicate rows and the GET handler's `SUM` aggregation doubles budgets.
- `budget_month: null` is the default (applies to all months). The GET handler includes these via `.or('budget_month.eq.YYYY-MM,budget_month.is.null')`.
- Subcategory slider changes fire N mutations (one per subcategory) per slider drag — `cancelQueries` in `onMutate` is essential to prevent N racing refetches.

## See Also

- [[Accounts & Balance Overview|Accounts & Balance]]
- `ERA Notes/01 - Architecture/Common Patterns.md` — optimistic mutation pattern
