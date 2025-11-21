import { prefetchDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { QueryClient } from "@tanstack/react-query";

/**
 * Prefetch all dashboard data for instant navigation
 * Call this when user hovers over dashboard link or before navigation
 */
export async function prefetchDashboardData(queryClient: QueryClient) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDate = startOfMonth.toISOString().split("T")[0];
  const endDate = endOfMonth.toISOString().split("T")[0];

  try {
    await prefetchDashboardTransactions(queryClient, { startDate, endDate });
  } catch (error) {
    console.error("Failed to prefetch dashboard data:", error);
  }
}
