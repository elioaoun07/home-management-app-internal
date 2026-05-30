import { isReallyOnline } from "@/lib/connectivityManager";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { QueryClient } from "@tanstack/react-query";

function shouldPrefetch(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): boolean {
  const state = queryClient.getQueryState(queryKey);
  if (!state) return true;
  if (state.status !== "success") return true;
  const dataAge = Date.now() - state.dataUpdatedAt;
  return dataAge > 60000;
}

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

export async function prefetchCategories(
  queryClient: QueryClient,
  accountId: string,
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

export async function prefetchExpenseData(queryClient: QueryClient) {
  try {
    await prefetchAccounts(queryClient);

    const ownKey = [...qk.accounts(), "own"];
    if (shouldPrefetch(queryClient, ownKey)) {
      await queryClient.prefetchQuery({
        queryKey: ownKey,
        queryFn: async () => {
          const res = await fetch("/api/accounts?own=true");
          if (!res.ok) throw new Error("Failed to fetch own accounts");
          return res.json();
        },
        staleTime: CACHE_TIMES.ACCOUNTS,
      });
    }

    const ownAccounts = queryClient.getQueryData(ownKey) as any[];
    const accounts =
      ownAccounts || (queryClient.getQueryData(qk.accounts()) as any[]);
    if (accounts && accounts.length > 0) {
      const defaultAccount = accounts.find((a: any) => a.is_default);
      if (defaultAccount) {
        await prefetchCategories(queryClient, defaultAccount.id);
      }
    }
  } catch {
    // silently ignore prefetch failures
  }
}

export async function prefetchAllTabs(queryClient: QueryClient) {
  if (!isReallyOnline()) return;

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
    shouldPrefetch(queryClient, transactionsKey) &&
      queryClient.prefetchQuery({
        queryKey: transactionsKey,
        queryFn: async () => {
          const response = await fetch(
            `/api/transactions?start=${startDate}&end=${endDate}`,
          );
          if (!response.ok) throw new Error("Failed to fetch transactions");
          return response.json();
        },
        staleTime: CACHE_TIMES.TRANSACTIONS,
      }),

    prefetchExpenseData(queryClient),

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
