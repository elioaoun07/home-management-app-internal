import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  category_color?: string;
  subcategory_color?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  /** True if this transaction is optimistic (not yet confirmed by server) */
  _isPending?: boolean;
};

type TransactionInput = {
  date: string;
  amount: number;
  description?: string;
  account_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  is_private?: boolean;
  // Optional display fields for optimistic UI (not sent to server)
  _optimistic?: {
    category_name?: string | null;
    subcategory_name?: string | null;
    account_name?: string | null;
    category_color?: string | null;
    subcategory_color?: string | null;
    user_name?: string | null;
  };
};

type TransactionUpdateInput = {
  id: string;
  date?: string;
  amount?: number;
  description?: string;
  account_id?: string;
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
 *
 * OPTIMIZED:
 * - 2 minute staleTime (was 0) - reduces unnecessary refetches
 * - Cache for 24 hours in memory
 * - Only refetch on reconnect or explicit invalidation
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
    // FRESH DATA STRATEGY:
    // staleTime: 0 means data is immediately stale after fetch
    // This ensures we always refetch on mount to get latest data
    // Combined with gcTime, we keep data in cache but always verify freshness
    staleTime: 0,
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour (for back navigation)
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Sync across devices
    refetchOnReconnect: true, // Refetch when reconnecting
    retry: 2,
    // Don't use stale data as placeholder - wait for fresh fetch
    // This prevents showing outdated transactions after adding new ones
    placeholderData: undefined,
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
      // Cancel outgoing refetches for ALL transaction queries
      await queryClient.cancelQueries({
        queryKey: ["transactions"],
        exact: false,
      });
      await queryClient.cancelQueries({
        queryKey: ["transactions-today"],
        exact: false,
      });
      await queryClient.cancelQueries({ queryKey: ["account-balance"] });

      // Snapshot ALL transaction queries
      const previousTransactions = queryClient.getQueriesData<Transaction[]>({
        queryKey: ["transactions"],
      });
      const previousTodayTransactions = queryClient.getQueriesData<any[]>({
        queryKey: ["transactions-today"],
      });

      // Find the transaction being deleted to get its amount and account_id for balance update
      let deletedTransaction: Transaction | undefined;
      for (const [, transactions] of previousTransactions) {
        if (transactions) {
          const found = transactions.find((t) => t.id === transactionId);
          if (found) {
            deletedTransaction = found;
            break;
          }
        }
      }

      // Snapshot the balance for potential rollback
      const accountId = deletedTransaction?.account_id;
      const previousBalance = accountId
        ? queryClient.getQueryData<{ balance: number }>([
            "account-balance",
            accountId,
          ])
        : undefined;

      // Optimistically update ALL transaction queries
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return old;
          return old.filter((t) => t.id !== transactionId);
        }
      );

      // Also update today's transactions
      queryClient.setQueriesData<any[]>(
        { queryKey: ["transactions-today"] },
        (old) => {
          if (!old) return old;
          return old.filter((t: any) => t.id !== transactionId);
        }
      );

      // CRITICAL: Optimistically update the balance (add back the deleted expense)
      if (deletedTransaction && previousBalance && accountId) {
        queryClient.setQueryData(["account-balance", accountId], {
          ...previousBalance,
          balance: previousBalance.balance + deletedTransaction.amount,
        });
      }

      return {
        previousTransactions,
        previousTodayTransactions,
        previousBalance,
        accountId,
      };
    },
    onError: (err, transactionId, context) => {
      // Rollback on error
      toast.error("Failed to delete transaction", { icon: ToastIcons.error });
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousTodayTransactions) {
        context.previousTodayTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback balance on error
      if (context?.previousBalance && context?.accountId) {
        queryClient.setQueryData(
          ["account-balance", context.accountId],
          context.previousBalance
        );
      }
    },
    onSettled: () => {
      // Mark all transaction queries as stale - they will refetch when next accessed
      // CRITICAL: Use refetchType: "none" to prevent immediate refetch which causes
      // the deleted item to briefly reappear (race condition with server)
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions-today"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["account-balance"],
        refetchType: "none",
      });
    },
    onSuccess: () => {
      toast.success("Transaction deleted", { icon: ToastIcons.delete });
    },
  });
}

/**
 * Add a transaction with optimistic updates
 * Transaction appears instantly in the UI, rolls back on error
 */
export function useAddTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: TransactionInput) => {
      // Remove _optimistic from the request - it's only for client-side UI
      const { _optimistic, ...serverTransaction } = transaction;
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverTransaction),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }

      return response.json();
    },
    onMutate: async (newTransaction) => {
      // Cancel outgoing refetches for ALL transaction queries
      await queryClient.cancelQueries({
        queryKey: ["transactions"],
        exact: false,
      });
      // Also cancel today's transactions queries
      await queryClient.cancelQueries({
        queryKey: ["transactions-today"],
        exact: false,
      });
      await queryClient.cancelQueries({ queryKey: ["account-balance"] });

      // Snapshot the previous values from ALL transaction queries
      const previousTransactions = queryClient.getQueriesData<Transaction[]>({
        queryKey: ["transactions"],
      });
      const previousBalance = queryClient.getQueryData([
        "account-balance",
        newTransaction.account_id,
      ]) as { balance: number } | undefined;

      // Try to get display names from _optimistic or look up from cache
      const opt = newTransaction._optimistic;

      // Helper to look up category/subcategory names from cached data
      let categoryName = opt?.category_name ?? null;
      let subcategoryName = opt?.subcategory_name ?? null;
      let accountName = opt?.account_name ?? undefined;
      let categoryColor = opt?.category_color ?? undefined;
      let subcategoryColor = opt?.subcategory_color ?? undefined;

      // If display names weren't provided, try to look them up from cache
      if (!categoryName && newTransaction.category_id) {
        // Look up from cached categories - key is ["categories", { accountId }]
        // Try with the account_id from the transaction
        let cats = queryClient.getQueryData<any[]>([
          "categories",
          { accountId: newTransaction.account_id },
        ]);

        // If not found, try to find any cached categories
        if (!cats) {
          const allCachedCategories = queryClient.getQueriesData<any[]>({
            queryKey: ["categories"],
          });
          for (const [, cachedCats] of allCachedCategories) {
            if (cachedCats && cachedCats.length > 0) {
              cats = cachedCats;
              break;
            }
          }
        }

        if (cats) {
          // Handle flat category list (parent categories have no parent_id)
          const cat = cats.find(
            (c: any) => c.id === newTransaction.category_id
          );
          if (cat) {
            categoryName = cat.name;
            categoryColor = cat.color;
            // Look for subcategory in nested subcategories
            if (newTransaction.subcategory_id && cat.subcategories) {
              const sub = cat.subcategories.find(
                (s: any) => s.id === newTransaction.subcategory_id
              );
              if (sub) {
                subcategoryName = sub.name;
                subcategoryColor = sub.color;
              }
            }
          }
          // Handle flat structure where subcategories are in the same array (have parent_id)
          if (newTransaction.subcategory_id && !subcategoryName) {
            const sub = cats.find(
              (c: any) => c.id === newTransaction.subcategory_id
            );
            if (sub) {
              subcategoryName = sub.name;
              subcategoryColor = sub.color;
            }
          }
        }
      }

      // Look up account name from cache if not provided
      if (!accountName && newTransaction.account_id) {
        // Account key is ["accounts", { userId }] - search all accounts caches
        const allCachedAccounts = queryClient.getQueriesData<any[]>({
          queryKey: ["accounts"],
        });
        for (const [, accounts] of allCachedAccounts) {
          if (accounts && accounts.length > 0) {
            const acc = accounts.find(
              (a: any) => a.id === newTransaction.account_id
            );
            if (acc) {
              accountName = acc.name;
              break;
            }
          }
        }
      }

      // Create optimistic transaction with a temporary ID
      const optimisticTransaction: Transaction = {
        id: `temp-${Date.now()}`, // Temporary ID, will be replaced by server
        date: newTransaction.date,
        amount: newTransaction.amount,
        description: newTransaction.description || null,
        account_id: newTransaction.account_id,
        category: categoryName,
        subcategory: subcategoryName,
        category_id: newTransaction.category_id,
        subcategory_id: newTransaction.subcategory_id,
        account_name: accountName,
        category_color: categoryColor,
        subcategory_color: subcategoryColor,
        user_name: opt?.user_name ?? undefined,
        inserted_at: new Date().toISOString(),
        _isPending: true, // Mark as pending until server confirms
      };

      // Optimistically add to ALL existing transaction queries
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return [optimisticTransaction];
          return [optimisticTransaction, ...old];
        }
      );

      // CRITICAL: Also explicitly set data for the default dashboard date range
      // This ensures optimistic updates work even if dashboard hasn't been visited
      const txDate = new Date(newTransaction.date);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // Store dashboard key for potential rollback
      let dashboardKey: string[] | null = null;
      let previousDashboardData: Transaction[] | undefined = undefined;

      if (txDate >= monthStart && txDate <= monthEnd) {
        const startStr = formatDate(monthStart);
        const endStr = formatDate(monthEnd);
        dashboardKey = ["transactions", "dashboard", startStr, endStr];
        previousDashboardData =
          queryClient.getQueryData<Transaction[]>(dashboardKey);

        // Set data for this specific dashboard query (creates it if doesn't exist)
        queryClient.setQueryData<Transaction[]>(dashboardKey, (old) => {
          if (!old) return [optimisticTransaction];
          // Avoid duplicates
          if (old.some((t) => t.id === optimisticTransaction.id)) return old;
          return [optimisticTransaction, ...old];
        });
      }

      // Also optimistically add to today's transactions if date is today
      const today = new Date().toISOString().split("T")[0];
      const previousTodayTransactions = queryClient.getQueriesData<any[]>({
        queryKey: ["transactions-today"],
      });
      if (newTransaction.date === today) {
        queryClient.setQueriesData<any[]>(
          { queryKey: ["transactions-today"] },
          (old) => {
            if (!old) return [optimisticTransaction];
            return [optimisticTransaction, ...old];
          }
        );
      }

      // Optimistically update balance (subtract the expense amount)
      if (previousBalance) {
        queryClient.setQueryData(
          ["account-balance", newTransaction.account_id],
          {
            ...previousBalance,
            balance: previousBalance.balance - newTransaction.amount,
          }
        );
      }

      return {
        previousTransactions,
        previousTodayTransactions,
        previousBalance,
        accountId: newTransaction.account_id,
        dashboardKey,
        previousDashboardData,
      };
    },
    onError: (err, newTransaction, context) => {
      // Rollback transactions on error
      toast.error("Failed to add transaction", { icon: ToastIcons.error });
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback dashboard query if we modified it
      if (context?.dashboardKey) {
        if (context.previousDashboardData) {
          queryClient.setQueryData(
            context.dashboardKey,
            context.previousDashboardData
          );
        } else {
          // Remove the query if it didn't exist before
          queryClient.removeQueries({ queryKey: context.dashboardKey });
        }
      }
      // Rollback today's transactions on error
      if (context?.previousTodayTransactions) {
        context.previousTodayTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback balance on error
      if (context?.previousBalance && context?.accountId) {
        queryClient.setQueryData(
          ["account-balance", context.accountId],
          context.previousBalance
        );
      }
    },
    onSuccess: (serverTransaction, variables) => {
      // Replace the optimistic (temp) transaction with the real server data
      // This ensures any cached queries have the correct transaction with real ID
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return [serverTransaction];
          // Replace temp transaction with server data
          const hasTemp = old.some((t) => t.id.startsWith("temp-"));
          if (hasTemp) {
            return old.map((t) =>
              t.id.startsWith("temp-") ? serverTransaction : t
            );
          }
          // If no temp found, add the server transaction (avoid duplicates)
          return [
            serverTransaction,
            ...old.filter((t) => t.id !== serverTransaction.id),
          ];
        }
      );

      // CRITICAL: Also set data directly for common dashboard date ranges
      // This ensures the transaction is visible when navigating to dashboard
      // even if the specific query wasn't cached yet
      const txDate = new Date(variables.date);
      const now = new Date();

      // Calculate the current month's date range (default dashboard view)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const formatDate = (d: Date) => d.toISOString().split("T")[0];

      // If transaction is in current month, ensure it's in the default dashboard cache
      if (txDate >= monthStart && txDate <= monthEnd) {
        const startStr = formatDate(monthStart);
        const endStr = formatDate(monthEnd);
        const dashboardKey = ["transactions", "dashboard", startStr, endStr];

        // Update the dashboard cache - it should exist from onMutate
        // Replace temp transaction with real server data
        queryClient.setQueryData<Transaction[]>(dashboardKey, (old) => {
          if (!old) return [serverTransaction];
          const hasTemp = old.some((t) => t.id.startsWith("temp-"));
          if (hasTemp) {
            return old.map((t) =>
              t.id.startsWith("temp-") ? serverTransaction : t
            );
          }
          // Avoid duplicates
          if (old.some((t) => t.id === serverTransaction.id)) return old;
          return [serverTransaction, ...old];
        });
      }

      // Also update today's transactions if applicable
      const today = new Date().toISOString().split("T")[0];
      if (variables.date === today) {
        queryClient.setQueriesData<any[]>(
          { queryKey: ["transactions-today"] },
          (old) => {
            if (!old) return [serverTransaction];
            const hasTemp = old.some((t: any) => t.id?.startsWith("temp-"));
            if (hasTemp) {
              return old.map((t: any) =>
                t.id?.startsWith("temp-") ? serverTransaction : t
              );
            }
            return [
              serverTransaction,
              ...old.filter((t: any) => t.id !== serverTransaction.id),
            ];
          }
        );
      }

      // Note: Success toast for "add" is handled by the calling component
      // which can include amount and category in the message
    },
    onSettled: () => {
      // Mark all transaction queries as stale - they will refetch when next accessed
      // Use refetchType: "none" to prevent immediate refetch - cache is already updated in onSuccess
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions-today"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["account-balance"],
        refetchType: "none",
      });
    },
  });
}

/**
 * Update a transaction with optimistic updates
 * Changes appear instantly, roll back on error
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: TransactionUpdateInput) => {
      const { id, ...data } = update;
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update transaction");
      }

      return response.json();
    },
    onMutate: async (update) => {
      // Cancel outgoing refetches for ALL transaction queries
      await queryClient.cancelQueries({
        queryKey: ["transactions"],
        exact: false,
      });
      await queryClient.cancelQueries({
        queryKey: ["transactions-today"],
        exact: false,
      });
      await queryClient.cancelQueries({ queryKey: ["account-balance"] });

      // Snapshot ALL transaction queries
      const previousTransactions = queryClient.getQueriesData<Transaction[]>({
        queryKey: ["transactions"],
      });
      const previousTodayTransactions = queryClient.getQueriesData<any[]>({
        queryKey: ["transactions-today"],
      });

      // Find the old transaction to calculate balance diff
      let oldTransaction: Transaction | undefined;
      previousTransactions.forEach(([, data]) => {
        if (Array.isArray(data)) {
          const found = data.find((t: Transaction) => t.id === update.id);
          if (found) oldTransaction = found;
        }
      });

      const previousBalance = oldTransaction
        ? (queryClient.getQueryData([
            "account-balance",
            oldTransaction.account_id,
          ]) as { balance: number } | undefined)
        : undefined;

      // Optimistically update transaction in ALL queries with _isPending flag
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return old;
          return old.map((t) =>
            t.id === update.id
              ? {
                  ...t,
                  ...update,
                  // Keep fields that aren't being updated
                  category: t.category,
                  subcategory: t.subcategory,
                  _isPending: true, // Show sync spinner until API confirms
                }
              : t
          );
        }
      );

      // Also update today's transactions with _isPending flag
      queryClient.setQueriesData<any[]>(
        { queryKey: ["transactions-today"] },
        (old) => {
          if (!old) return old;
          return old.map((t: any) =>
            t.id === update.id
              ? {
                  ...t,
                  ...update,
                  _isPending: true, // Show sync spinner until API confirms
                }
              : t
          );
        }
      );

      // Optimistically update balance if amount changed
      if (previousBalance && oldTransaction && update.amount !== undefined) {
        const amountDiff = update.amount - oldTransaction.amount;
        queryClient.setQueryData(
          ["account-balance", oldTransaction.account_id],
          {
            ...previousBalance,
            balance: previousBalance.balance - amountDiff,
          }
        );
      }

      return {
        previousTransactions,
        previousTodayTransactions,
        previousBalance,
        accountId: oldTransaction?.account_id,
      };
    },
    onError: (err, update, context) => {
      // Rollback transactions on error
      toast.error("Failed to update transaction", { icon: ToastIcons.error });
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback today's transactions on error
      if (context?.previousTodayTransactions) {
        context.previousTodayTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Rollback balance on error
      if (context?.previousBalance && context?.accountId) {
        queryClient.setQueryData(
          ["account-balance", context.accountId],
          context.previousBalance
        );
      }
    },
    onSuccess: (data, update) => {
      // Clear _isPending flag from the updated transaction
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return old;
          return old.map((t) =>
            t.id === update.id ? { ...t, _isPending: false } : t
          );
        }
      );
      queryClient.setQueriesData<any[]>(
        { queryKey: ["transactions-today"] },
        (old) => {
          if (!old) return old;
          return old.map((t: any) =>
            t.id === update.id ? { ...t, _isPending: false } : t
          );
        }
      );

      // Show success toast
      toast.success("Transaction updated", { icon: ToastIcons.update });
    },
    onSettled: () => {
      // Mark all transaction queries as stale - they will refetch when next accessed
      // Use refetchType: "none" to prevent immediate refetch which could cause flickering
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions-today"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["account-balance"],
        refetchType: "none",
      });
    },
  });
}
