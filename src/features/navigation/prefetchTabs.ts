import { qk } from "@/lib/queryKeys";
import { QueryClient } from "@tanstack/react-query";

/**
 * Prefetch accounts for instant expense page load
 */
export async function prefetchAccounts(queryClient: QueryClient) {
  return queryClient.prefetchQuery({
    queryKey: qk.accounts(),
    queryFn: async () => {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Prefetch categories for a specific account
 */
export async function prefetchCategories(
  queryClient: QueryClient,
  accountId: string
) {
  return queryClient.prefetchQuery({
    queryKey: qk.categories(accountId),
    queryFn: async () => {
      const qs = new URLSearchParams({ accountId });
      const res = await fetch(`/api/categories?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Prefetch all expense page data for instant load
 * Includes accounts and categories for default account
 */
export async function prefetchExpenseData(queryClient: QueryClient) {
  try {
    // First prefetch accounts
    await prefetchAccounts(queryClient);

    // Get cached accounts to find default
    const accounts = queryClient.getQueryData(qk.accounts()) as any[];
    if (accounts && accounts.length > 0) {
      const defaultAccount = accounts.find((a: any) => a.is_default);
      if (defaultAccount) {
        // Prefetch categories for default account
        await prefetchCategories(queryClient, defaultAccount.id);
      }
    }
  } catch (error) {
    console.error("Failed to prefetch expense data:", error);
  }
}

/**
 * Prefetch all navigation tabs data for instant switching
 */
export async function prefetchAllTabs(queryClient: QueryClient) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDate = startOfMonth.toISOString().split("T")[0];
  const endDate = endOfMonth.toISOString().split("T")[0];

  await Promise.allSettled([
    // Prefetch dashboard transactions
    queryClient.prefetchQuery({
      queryKey: ["transactions", "dashboard", startDate, endDate],
      queryFn: async () => {
        const response = await fetch(
          `/api/transactions?start=${startDate}&end=${endDate}`
        );
        if (!response.ok) throw new Error("Failed to fetch transactions");
        return response.json();
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
    }),

    // Prefetch expense page data
    prefetchExpenseData(queryClient),

    // Prefetch user preferences
    queryClient.prefetchQuery({
      queryKey: ["user-preferences"],
      queryFn: async () => {
        const response = await fetch("/api/user-preferences");
        if (!response.ok) throw new Error("Failed to fetch preferences");
        return response.json();
      },
      staleTime: 1000 * 60 * 60, // 1 hour
    }),

    // Prefetch onboarding status
    queryClient.prefetchQuery({
      queryKey: ["onboarding"],
      queryFn: async () => {
        const response = await fetch("/api/onboarding");
        if (!response.ok) throw new Error("Failed to fetch onboarding");
        return response.json();
      },
      staleTime: 1000 * 60 * 60 * 24, // 24 hours
    }),

    // Prefetch recurring payments for badge
    queryClient.prefetchQuery({
      queryKey: ["recurring-payments", "due"],
      queryFn: async () => {
        const response = await fetch("/api/recurring-payments?due_only=true");
        if (!response.ok) throw new Error("Failed to fetch recurring");
        const data = await response.json();
        return data.recurring_payments || [];
      },
      staleTime: 1000 * 60 * 30, // 30 minutes
    }),
  ]);
}
