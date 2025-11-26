import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { QueryClient } from "@tanstack/react-query";

/**
 * OPTIMIZED: Only prefetch if data is stale or missing
 * Prevents unnecessary network requests on app startup
 */
function shouldPrefetch(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): boolean {
  const state = queryClient.getQueryState(queryKey);
  if (!state) return true; // No data, should fetch
  if (state.status !== "success") return true; // Not successful, should fetch

  // Check if data is fresh (less than 1 minute old)
  const dataAge = Date.now() - state.dataUpdatedAt;
  return dataAge > 60000; // Only prefetch if data is older than 1 minute
}

/**
 * Prefetch accounts for instant expense page load
 * OPTIMIZED: Skip if fresh data exists
 */
export async function prefetchAccounts(queryClient: QueryClient) {
  if (!shouldPrefetch(queryClient, qk.accounts())) return;

  return queryClient.prefetchQuery({
    queryKey: qk.accounts(),
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
    staleTime: CACHE_TIMES.ACCOUNTS,
  });
}

/**
 * Prefetch categories for a specific account
 * OPTIMIZED: Skip if fresh data exists
 */
export async function prefetchCategories(
  queryClient: QueryClient,
  accountId: string
) {
  if (!shouldPrefetch(queryClient, qk.categories(accountId))) return;

  return queryClient.prefetchQuery({
    queryKey: qk.categories(accountId),
    queryFn: async () => {
      const qs = new URLSearchParams({ accountId });
      const res = await fetch(`/api/categories?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    staleTime: CACHE_TIMES.CATEGORIES,
  });
}

/**
 * Prefetch all expense page data for instant load
 * OPTIMIZED: Skip data that's already cached
 */
export async function prefetchExpenseData(queryClient: QueryClient) {
  try {
    // First prefetch accounts if needed
    await prefetchAccounts(queryClient);

    // Get cached accounts to find default
    const accounts = queryClient.getQueryData(qk.accounts()) as any[];
    if (accounts && accounts.length > 0) {
      const defaultAccount = accounts.find((a: any) => a.is_default);
      if (defaultAccount) {
        // Prefetch categories for default account if needed
        await prefetchCategories(queryClient, defaultAccount.id);
      }
    }
  } catch (error) {
    console.error("Failed to prefetch expense data:", error);
  }
}

/**
 * Prefetch all navigation tabs data for instant switching
 * OPTIMIZED: Only prefetch stale/missing data
 */
export async function prefetchAllTabs(queryClient: QueryClient) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDate = startOfMonth.toISOString().split("T")[0];
  const endDate = endOfMonth.toISOString().split("T")[0];

  const transactionsKey = [
    "transactions",
    "dashboard",
    startDate,
    endDate,
  ] as const;
  const preferencesKey = ["user-preferences"] as const;
  const onboardingKey = ["onboarding"] as const;
  const draftsKey = qk.drafts() as readonly unknown[];

  await Promise.allSettled([
    // Prefetch dashboard transactions (only if stale)
    shouldPrefetch(queryClient, transactionsKey) &&
      queryClient.prefetchQuery({
        queryKey: transactionsKey,
        queryFn: async () => {
          const response = await fetch(
            `/api/transactions?start=${startDate}&end=${endDate}`
          );
          if (!response.ok) throw new Error("Failed to fetch transactions");
          return response.json();
        },
        staleTime: CACHE_TIMES.TRANSACTIONS,
      }),

    // Prefetch expense page data
    prefetchExpenseData(queryClient),

    // Prefetch user preferences (only if stale)
    shouldPrefetch(queryClient, preferencesKey) &&
      queryClient.prefetchQuery({
        queryKey: preferencesKey,
        queryFn: async () => {
          const response = await fetch("/api/user-preferences");
          if (!response.ok) throw new Error("Failed to fetch preferences");
          return response.json();
        },
        staleTime: CACHE_TIMES.PREFERENCES,
      }),

    // Prefetch onboarding status (only if stale)
    shouldPrefetch(queryClient, onboardingKey) &&
      queryClient.prefetchQuery({
        queryKey: onboardingKey,
        queryFn: async () => {
          const response = await fetch("/api/onboarding");
          if (!response.ok) throw new Error("Failed to fetch onboarding");
          return response.json();
        },
        staleTime: CACHE_TIMES.ONBOARDING,
      }),

    // Prefetch draft transactions (for badge count at startup)
    shouldPrefetch(queryClient, draftsKey) &&
      queryClient.prefetchQuery({
        queryKey: qk.drafts(),
        queryFn: async () => {
          const response = await fetch("/api/drafts");
          if (!response.ok) throw new Error("Failed to fetch drafts");
          return response.json();
        },
        staleTime: CACHE_TIMES.DRAFTS,
      }),
  ]);
}
