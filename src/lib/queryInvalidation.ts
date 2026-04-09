// src/lib/queryInvalidation.ts
//
// Centralized cache invalidation helpers.
//
// Rule: ANY mutation that changes account balance data (direct edit, transaction
// CRUD, transfer, recurring) MUST call invalidateAccountData() instead of
// manually invalidating individual keys. This prevents stale data in views
// (Review v2, Analytics, Dashboard) that read the same data under different
// query keys. See Hard Rule #20 in CLAUDE.md.

import { QueryClient } from "@tanstack/react-query";
import { qk } from "./queryKeys";

// Analytics localStorage cache key prefix — mirrors ANALYTICS_CACHE_KEY in
// src/features/analytics/useAnalytics.ts. Must stay in sync if that key changes.
const ANALYTICS_LS_PREFIX = "analytics-v2";

/**
 * Clear all analytics localStorage entries.
 *
 * useAnalytics() stores API responses in localStorage and feeds them back as
 * React Query `initialData`. If the localStorage entry is < 10 minutes old,
 * React Query treats it as "fresh" and skips the refetch even if the React
 * Query cache was invalidated. Clearing localStorage here ensures that after
 * a page reload (or any scenario where the React Query in-memory cache is
 * gone) the hook fetches fresh data from the server.
 */
function clearAnalyticsLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(ANALYTICS_LS_PREFIX),
    );
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // quota / security errors — ignore
  }
}

/**
 * Invalidate all queries whose data depends on account balance.
 * Covers: accounts list, analytics (React Query cache + localStorage),
 * and optionally the per-account balance + history queries.
 *
 * @param queryClient - The React Query client
 * @param accountId   - When provided, also invalidates the per-account keys
 */
export function invalidateAccountData(
  queryClient: QueryClient,
  accountId?: string,
) {
  // 1. Clear analytics localStorage so initialData doesn't restore stale data
  //    after a page reload (see clearAnalyticsLocalStorage docstring above).
  clearAnalyticsLocalStorage();

  // 2. React Query cache invalidation — covers all active & inactive entries
  //    that start with these prefixes (React Query uses prefix/fuzzy matching
  //    by default when exact: false, which is the default).

  // All views that show account lists or balances (prefix matches "own" / "withHidden" variants)
  queryClient.invalidateQueries({ queryKey: qk.accounts() });

  // Review v2 / Analytics dashboard reads balances from this query
  // Matches all ["analytics", { months, accountId, ownership }] entries
  queryClient.invalidateQueries({ queryKey: qk.analytics() });

  if (accountId) {
    // Per-account balance widget (eager refetch)
    queryClient.invalidateQueries({ queryKey: ["account-balance", accountId] });
    // Balance history chart (no eager refetch — only needed when user opens it)
    queryClient.invalidateQueries({
      queryKey: ["balance-history"],
      refetchType: "none",
    });
  }
}
