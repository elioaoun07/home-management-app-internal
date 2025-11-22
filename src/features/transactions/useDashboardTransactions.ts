import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  inserted_at: string;
  user_id?: string;
  user_name?: string;
  account_name?: string;
  category_icon?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
};

type DashboardParams = {
  startDate: string;
  endDate: string;
};

/**
 * Fetch transactions for dashboard with aggressive caching
 * Uses stale-while-revalidate pattern for instant UI
 */
export function useDashboardTransactions({
  startDate,
  endDate,
}: DashboardParams) {
  return useQuery({
    queryKey: ["transactions", "dashboard", startDate, endDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/transactions?start=${startDate}&end=${endDate}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      return data as Transaction[];
    },
    staleTime: 0, // Always refetch when invalidated
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnMount: true, // Refetch to show latest transactions
    refetchOnWindowFocus: false, // Don't refetch on window focus (better UX)
    refetchOnReconnect: true, // Refetch when reconnecting
    retry: 2,
  });
}

/**
 * Prefetch transactions for given date range
 * Call this before navigating to dashboard for instant load
 */
export function prefetchDashboardTransactions(
  queryClient: any,
  params: DashboardParams
) {
  return queryClient.prefetchQuery({
    queryKey: ["transactions", "dashboard", params.startDate, params.endDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/transactions?start=${params.startDate}&end=${params.endDate}`
      );
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Delete a transaction with optimistic updates
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transaction");
      }

      return transactionId;
    },
    onMutate: async (transactionId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["transactions"] });

      // Snapshot the previous value
      const previousTransactions = queryClient.getQueriesData({
        queryKey: ["transactions"],
      });

      // Optimistically update all transaction queries
      queryClient.setQueriesData(
        { queryKey: ["transactions"] },
        (old: Transaction[] | undefined) => {
          if (!old) return old;
          return old.filter((t) => t.id !== transactionId);
        }
      );

      return { previousTransactions };
    },
    onError: (err, transactionId, context) => {
      // Rollback on error
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "active",
      });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    },
  });
}

/**
 * Add a transaction with automatic cache updates
 */
export function useAddTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: {
      date: string;
      amount: number;
      description?: string;
      account_id: string;
      category_id?: string | null;
      subcategory_id?: string | null;
      is_private?: boolean;
    }) => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch all transaction queries
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "active",
      });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    },
  });
}
