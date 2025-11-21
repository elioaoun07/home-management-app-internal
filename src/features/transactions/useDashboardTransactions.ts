import { useQuery } from "@tanstack/react-query";

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
    staleTime: 1000 * 60 * 5, // Consider fresh for 5 minutes
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnMount: false, // Use cached data first for instant load
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
