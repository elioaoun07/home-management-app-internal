import { getBalanceDelta, type AccountType } from "@/lib/balance-utils";
import { isReallyOnline, markOffline } from "@/lib/connectivityManager";
import { sendSplitBillNotification } from "@/lib/notifications/sendSplitBillNotification";
import { addToQueue } from "@/lib/offlineQueue";
import { isOfflineError, safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Look up an account's type from the React Query cache.
 * Falls back to "expense" so optimistic updates never crash.
 */
function getAccountTypeFromCache(
  queryClient: ReturnType<typeof useQueryClient>,
  accountId: string,
): AccountType {
  const allCachedAccounts = queryClient.getQueriesData<
    Array<{ id: string; type: AccountType }>
  >({ queryKey: ["accounts"] });

  for (const [, accounts] of allCachedAccounts) {
    if (accounts && accounts.length > 0) {
      const acc = accounts.find((a) => a.id === accountId);
      if (acc?.type) return acc.type;
    }
  }
  return "expense"; // safe default
}

// fetchWithTimeout / isNetworkError / isOfflineError removed —
// replaced by the centralized safeFetch module (src/lib/safeFetch.ts)
// which provides a 5-second AbortController timeout, browser offline
// event listener, pre-flight connectivity check, and automatic
// markOffline() on failure.

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
  is_private?: boolean;
  is_owner?: boolean;
  /** True if current user is the collaborator on a completed split transaction */
  is_collaborator?: boolean;
  user_theme?: string;
  /** True if this transaction is optimistic (not yet confirmed by server) */
  _isPending?: boolean;
  // Split bill fields
  split_requested?: boolean;
  collaborator_id?: string;
  collaborator_amount?: number;
  collaborator_description?: string;
  split_completed_at?: string;
  total_amount?: number;
  // Debt fields (joined from debts table)
  debt_id?: string | null;
  debtor_name?: string | null;
  debt_status?: "open" | "archived" | "closed" | null;
  debt_original_amount?: number | null;
  debt_returned_amount?: number | null;
  /** Net cost after debt settlements (original - returned) */
  debt_net_cost?: number | null;
  // Future payment fields
  scheduled_date?: string | null;
  is_debt_return?: boolean;
};

type TransactionInput = {
  date: string;
  amount: number;
  description?: string;
  account_id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  is_private?: boolean;
  split_requested?: boolean;
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

// --------------- localStorage transaction cache ---------------
// Provides instant rendering on cold start (page refresh / new tab).
// Optimistic updates ONLY touch React Query's in-memory cache — never
// localStorage — so the two systems can't conflict.
// Uses localStorage (persistent) so history data survives across sessions.
const TX_CACHE_PREFIX = "tx-cache-";
const TX_CACHE_LATEST_KEY = "tx-cache-latest"; // Stable alias — written for every single-day fetch
const TX_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function getTxCacheKey(start: string, end: string) {
  return `${TX_CACHE_PREFIX}${start}_${end}`;
}

/** Remove oldest date-keyed cache entries when there are more than 7. */
function cleanupOldTxCaches() {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(TX_CACHE_PREFIX) && k !== TX_CACHE_LATEST_KEY,
    );
    if (keys.length <= 7) return;
    const entries = keys
      .map((k) => {
        try {
          return { key: k, ts: JSON.parse(localStorage.getItem(k)!).ts as number };
        } catch {
          return { key: k, ts: 0 };
        }
      })
      .sort((a, b) => b.ts - a.ts);
    entries.slice(7).forEach((e) => localStorage.removeItem(e.key));
  } catch {
    /* ignore */
  }
}

function readTxCache(
  start: string,
  end: string,
): { data: Transaction[]; ts: number } | undefined {
  try {
    // Try exact date-range match first
    const raw = localStorage.getItem(getTxCacheKey(start, end));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > TX_CACHE_MAX_AGE) {
        localStorage.removeItem(getTxCacheKey(start, end));
      } else {
        return parsed;
      }
    }
    // Fallback: for single-day "today" requests with no exact match,
    // return the latest alias so the user sees last-known data instantly
    // instead of a skeleton. ts=0 makes RQ treat it as infinitely stale →
    // triggers an immediate background refetch to get today's real data.
    const today = new Date().toISOString().split("T")[0];
    if (start === today && end === today) {
      const aliasRaw = localStorage.getItem(TX_CACHE_LATEST_KEY);
      if (aliasRaw) {
        const parsed = JSON.parse(aliasRaw);
        if (Date.now() - parsed.ts > TX_CACHE_MAX_AGE) return undefined;
        return { data: parsed.data, ts: 0 };
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeTxCache(start: string, end: string, data: Transaction[]) {
  try {
    // Cap at 300 entries to stay well within localStorage quota
    const trimmed = data.slice(0, 300);
    const payload = JSON.stringify({ data: trimmed, ts: Date.now() });
    localStorage.setItem(getTxCacheKey(start, end), payload);
    // Also write stable alias for single-day ranges so the next cold start
    // (new day) can show last-known data instantly while fresh data loads.
    if (start === end) {
      localStorage.setItem(TX_CACHE_LATEST_KEY, payload);
    }
    // Prevent localStorage bloat from accumulating old date-keyed entries
    cleanupOldTxCaches();
  } catch {
    /* quota exceeded — ignore */
  }
}

/**
 * Sync all in-memory transaction queries to localStorage so mutations
 * (add/update/delete) are reflected in the persistent cache immediately.
 * Call this in mutation onSettled callbacks.
 */
function syncTxCacheToLocalStorage(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const allQueries = queryClient.getQueriesData<Transaction[]>({
    queryKey: ["transactions", "dashboard"],
  });
  for (const [key, data] of allQueries) {
    if (data && key.length >= 4) {
      writeTxCache(key[2] as string, key[3] as string, data);
    }
  }
}

/**
 * Fetch transactions for dashboard with persistent caching
 * Uses stale-while-revalidate pattern for instant UI
 *
 * CACHING STRATEGY:
 * 1. In-memory: React Query cache (gcTime: 24h) for within-session navigation
 * 2. Persistent: localStorage for cold-start instant rendering (survives across sessions)
 *    - Written on every successful fetch
 *    - Read as `initialData` only when RQ cache is empty
 *    - Optimistic updates never touch localStorage (avoids conflicts)
 * 3. Staleness: staleTime 10min → shows cached data instantly, only refreshes via
 *    manual refresh button or when adding new transactions
 */
export function useDashboardTransactions({
  startDate,
  endDate,
}: DashboardParams) {
  const isOffline = typeof navigator !== "undefined" && !isReallyOnline();

  return useQuery({
    queryKey: ["transactions", "dashboard", startDate, endDate],
    queryFn: async () => {
      // Guard: don't even try to fetch when offline
      if (!isReallyOnline()) {
        throw new Error("Offline");
      }
      const response = await fetch(
        `/api/transactions?start=${startDate}&end=${endDate}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = (await response.json()) as Transaction[];

      // Persist to localStorage for instant cold-start rendering
      writeTxCache(startDate, endDate, data);

      return data;
    },

    // Seed from localStorage so the user never sees a skeleton on page refresh.
    // Once React Query's own cache has data, initialData is ignored.
    initialData: () => {
      if (typeof window === "undefined") return undefined;
      return readTxCache(startDate, endDate)?.data;
    },
    initialDataUpdatedAt: () => {
      if (typeof window === "undefined") return undefined;
      return readTxCache(startDate, endDate)?.ts;
    },

    // PERSISTENT DATA STRATEGY:
    // staleTime: 10 min → cached data shown instantly, no refetch on every visit
    // User taps refresh icon to pull latest data, or it auto-refreshes after 10 min
    // Mutations (add/delete transaction) invalidate the cache immediately
    staleTime: 1000 * 60 * 10, // 10 minutes — history rarely changes
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnMount: false, // Don't refetch on every mount — use cached data
    refetchOnWindowFocus: false, // Don't refetch on tab focus
    refetchOnReconnect: true, // Refetch when reconnecting
    retry: (failureCount) => {
      if (!isReallyOnline()) return false;
      return failureCount < 2;
    },
    // Keep showing previous data while fetching new data for smooth transitions
    // This prevents the skeleton flash when changing date ranges
    placeholderData: keepPreviousData,
  });
}

/**
 * Prefetch transactions for given date range
 * Call this before navigating to dashboard for instant load
 */
export function prefetchDashboardTransactions(
  queryClient: any,
  params: DashboardParams,
) {
  return queryClient.prefetchQuery({
    queryKey: ["transactions", "dashboard", params.startDate, params.endDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/transactions?start=${params.startDate}&end=${params.endDate}`,
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
    mutationFn: async (input: string | { id: string; _silent?: boolean }) => {
      const transactionId = typeof input === "string" ? input : input.id;

      // Offline-first: queue if we know we're offline (real connectivity check)
      if (!isReallyOnline()) {
        await addToQueue({
          feature: "transaction",
          operation: "delete",
          endpoint: `/api/transactions/${transactionId}`,
          method: "DELETE",
          body: {},
          metadata: { label: `Delete transaction` },
        });
        return transactionId;
      }

      // Try network with timeout — fall back to queue on network failure
      try {
        const response = await safeFetch(`/api/transactions/${transactionId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Session expired — please sign in again");
          }
          throw new Error(`Failed to delete transaction (${response.status})`);
        }

        return transactionId;
      } catch (err) {
        if (isOfflineError(err)) {
          markOffline();
          await addToQueue({
            feature: "transaction",
            operation: "delete",
            endpoint: `/api/transactions/${transactionId}`,
            method: "DELETE",
            body: {},
            metadata: { label: `Delete transaction` },
          });
          return transactionId;
        }
        throw err;
      }
    },
    onMutate: async (input) => {
      const transactionId = typeof input === "string" ? input : input.id;
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
        },
      );

      // Also update today's transactions
      queryClient.setQueriesData<any[]>(
        { queryKey: ["transactions-today"] },
        (old) => {
          if (!old) return old;
          return old.filter((t: any) => t.id !== transactionId);
        },
      );

      // CRITICAL: Optimistically update the balance (reverse the deleted transaction)
      if (deletedTransaction && previousBalance && accountId) {
        const accountType = getAccountTypeFromCache(queryClient, accountId);
        const delta = getBalanceDelta(
          deletedTransaction.amount,
          accountType,
          !!deletedTransaction.is_debt_return,
          "delete",
        );
        queryClient.setQueryData(["account-balance", accountId], {
          ...previousBalance,
          balance: previousBalance.balance + delta,
        });
      }

      return {
        previousTransactions,
        previousTodayTransactions,
        previousBalance,
        accountId,
        deletedTransaction,
      };
    },
    onError: (err, input, context) => {
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
          context.previousBalance,
        );
      }
    },
    onSettled: () => {
      // Sync in-memory state to localStorage so the next cold start is instant
      syncTxCacheToLocalStorage(queryClient);
      // Mark transaction queries as stale (refetch lazily to avoid deleted item flashing back)
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions-today"],
        refetchType: "none",
      });
      // Refetch balance from server to confirm optimistic update
      queryClient.invalidateQueries({
        queryKey: ["account-balance"],
        refetchType: "active",
      });
    },
    onSuccess: (_, input, context) => {
      const isSilent = typeof input === "object" && input._silent;
      if (isSilent) return; // Caller handles its own toast (e.g. undo flows)

      const deleted = context?.deletedTransaction;
      toast.success("Transaction deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              if (deleted) {
                const response = await fetch("/api/transactions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    date: deleted.date,
                    amount: deleted.amount,
                    description: deleted.description,
                    account_id: deleted.account_id,
                    category_id: deleted.category_id,
                    subcategory_id: deleted.subcategory_id,
                    is_private: deleted.is_private,
                  }),
                });
                if (!response.ok) throw new Error("Failed to recreate");
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
                queryClient.invalidateQueries({
                  queryKey: ["transactions-today"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["account-balance"],
                });
                toast.success("Deletion undone");
              }
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
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

      // Helper to queue offline and return fake response
      const queueOfflineCreate = async () => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        console.log(
          `[OFFLINE] mutationFn: queueOfflineCreate() tempId=${tempId}`,
        );
        await addToQueue({
          feature: "transaction",
          operation: "create",
          endpoint: "/api/transactions",
          method: "POST",
          body: serverTransaction,
          tempId,
          metadata: {
            label: `Add ${serverTransaction.description || "transaction"} $${serverTransaction.amount}`,
          },
        });
        // Also update the localStorage cached balance for offline display
        if (serverTransaction.account_id) {
          try {
            const { getCachedBalance, setCachedBalance } = await import(
              "@/lib/queryConfig"
            );
            const { getBalanceDelta: getDelta } = await import(
              "@/lib/balance-utils"
            );
            const cached = getCachedBalance(serverTransaction.account_id);
            if (cached) {
              // We don't have cache access here, default to expense for offline
              const delta = getDelta(
                serverTransaction.amount,
                "expense",
                false,
                "create",
              );
              setCachedBalance(
                serverTransaction.account_id,
                cached.balance + delta,
              );
            }
          } catch {
            /* ignore */
          }
        }
        return {
          id: tempId,
          ...serverTransaction,
          inserted_at: new Date().toISOString(),
          _isPending: true,
          _offline: true,
        };
      };

      // Offline-first: queue if we know we're offline (real connectivity check)
      const onlineCheck = isReallyOnline();
      console.log(
        `[OFFLINE] mutationFn: isReallyOnline()=${onlineCheck}, navigator.onLine=${typeof navigator !== "undefined" ? navigator.onLine : "N/A"}`,
      );
      if (!onlineCheck) {
        console.log(
          "[OFFLINE] mutationFn: PRE-FLIGHT OFFLINE -> queueing immediately",
        );
        return queueOfflineCreate();
      }

      // Try network with timeout — fall back to queue on network failure
      try {
        const response = await safeFetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serverTransaction),
        });

        if (!response.ok) {
          // Distinguish auth errors from server errors
          if (response.status === 401 || response.status === 403) {
            throw new Error("Session expired — please sign in again");
          }
          throw new Error(`Failed to create transaction (${response.status})`);
        }

        return response.json();
      } catch (err) {
        console.log(
          `[OFFLINE] mutationFn: CATCH ${(err as Error)?.name}: ${(err as Error)?.message}`,
        );
        console.log(
          `[OFFLINE] mutationFn: isOfflineError=${isOfflineError(err)}`,
        );
        if (isOfflineError(err)) {
          markOffline();
          console.log(
            "[OFFLINE] mutationFn: falling back to queueOfflineCreate()",
          );
          return queueOfflineCreate();
        }
        throw err;
      }
    },
    onMutate: async (newTransaction) => {
      console.log(
        `[OFFLINE] onMutate: starting optimistic update for $${newTransaction.amount}`,
      );
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
            (c: any) => c.id === newTransaction.category_id,
          );
          if (cat) {
            categoryName = cat.name;
            categoryColor = cat.color;
            // Look for subcategory in nested subcategories
            if (newTransaction.subcategory_id && cat.subcategories) {
              const sub = cat.subcategories.find(
                (s: any) => s.id === newTransaction.subcategory_id,
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
              (c: any) => c.id === newTransaction.subcategory_id,
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
              (a: any) => a.id === newTransaction.account_id,
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
        },
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
          },
        );
      }

      // Optimistically update balance using account-type-aware delta
      if (previousBalance) {
        const accountType = getAccountTypeFromCache(
          queryClient,
          newTransaction.account_id,
        );
        const delta = getBalanceDelta(
          newTransaction.amount,
          accountType,
          false,
          "create",
        );
        queryClient.setQueryData(
          ["account-balance", newTransaction.account_id],
          {
            ...previousBalance,
            balance: previousBalance.balance + delta,
          },
        );
      }

      return {
        previousTransactions,
        previousTodayTransactions,
        previousBalance,
        accountId: newTransaction.account_id,
        dashboardKey,
        previousDashboardData,
        optimisticId: optimisticTransaction.id,
      };
    },
    onError: (err, newTransaction, context) => {
      console.log(`[OFFLINE] onError: ${(err as Error)?.message}`);
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
            context.previousDashboardData,
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
          context.previousBalance,
        );
      }
    },
    onSuccess: (serverTransaction, variables, context) => {
      console.log(
        `[OFFLINE] onSuccess: id=${serverTransaction?.id}, _offline=${serverTransaction?._offline}, _isPending=${serverTransaction?._isPending}`,
      );
      // If this was queued offline, ensure pending count is refreshed.
      // Belt-and-suspenders: re-fire event so SyncContext also picks it up
      // (Zustand store was already updated synchronously in addToQueue).
      if (serverTransaction?._offline) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("offline-queue-changed"));
        }
      }

      // Replace the optimistic (temp) transaction with the real server data
      // This ensures any cached queries have the correct transaction with real ID
      // IMPORTANT: Only replace the SPECIFIC optimistic entry from this mutation,
      // not all temp-* entries (which may belong to other in-flight mutations)
      const optimisticId = context?.optimisticId;
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return [serverTransaction];
          if (optimisticId && old.some((t) => t.id === optimisticId)) {
            return old.map((t) =>
              t.id === optimisticId ? serverTransaction : t,
            );
          }
          // If no matching optimistic found, add the server transaction (avoid duplicates)
          return [
            serverTransaction,
            ...old.filter((t) => t.id !== serverTransaction.id),
          ];
        },
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
        // Replace the specific optimistic entry with real server data
        queryClient.setQueryData<Transaction[]>(dashboardKey, (old) => {
          if (!old) return [serverTransaction];
          if (optimisticId && old.some((t) => t.id === optimisticId)) {
            return old.map((t) =>
              t.id === optimisticId ? serverTransaction : t,
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
            if (optimisticId && old.some((t: any) => t.id === optimisticId)) {
              return old.map((t: any) =>
                t.id === optimisticId ? serverTransaction : t,
              );
            }
            return [
              serverTransaction,
              ...old.filter((t: any) => t.id !== serverTransaction.id),
            ];
          },
        );
      }

      // Success toast is handled by the calling component
      // which provides context-specific messages (e.g. "Expense added!", "Income added!", "Split bill sent!")

      // Send push notification if this is a split bill request
      if (variables.split_requested && serverTransaction.collaborator_id) {
        sendSplitBillNotification({
          transactionId: serverTransaction.id,
          collaboratorId: serverTransaction.collaborator_id,
          amount: serverTransaction.amount,
          categoryName: serverTransaction.category || undefined,
          description: serverTransaction.description || undefined,
        });
      }
    },
    onSettled: () => {
      // Sync in-memory state to localStorage so the next cold start is instant
      syncTxCacheToLocalStorage(queryClient);
      // Transaction cache is already updated in onSuccess, mark stale for lazy refetch
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions-today"],
        refetchType: "none",
      });
      // Refetch balance from server to confirm optimistic update
      queryClient.invalidateQueries({
        queryKey: ["account-balance"],
        refetchType: "active",
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

      // Helper to queue offline
      const queueOfflineUpdate = async () => {
        await addToQueue({
          feature: "transaction",
          operation: "update",
          endpoint: `/api/transactions/${id}`,
          method: "PATCH",
          body: data,
          metadata: {
            label: `Update transaction${data.amount ? ` $${data.amount}` : ""}`,
          },
        });
        return { id, ...data, _isPending: true, _offline: true };
      };

      // Offline-first: queue if we know we're offline (real connectivity check)
      if (!isReallyOnline()) {
        return queueOfflineUpdate();
      }

      // Try network with timeout — fall back to queue on network failure
      try {
        const response = await safeFetch(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("Session expired — please sign in again");
          }
          throw new Error(`Failed to update transaction (${response.status})`);
        }

        return response.json();
      } catch (err) {
        if (isOfflineError(err)) {
          markOffline();
          return queueOfflineUpdate();
        }
        throw err;
      }
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
              : t,
          );
        },
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
              : t,
          );
        },
      );

      // Optimistically update balance if amount changed
      if (previousBalance && oldTransaction && update.amount !== undefined) {
        const accountType = getAccountTypeFromCache(
          queryClient,
          oldTransaction.account_id,
        );
        // Reverse old amount, apply new amount
        const oldDelta = getBalanceDelta(
          oldTransaction.amount,
          accountType,
          !!oldTransaction.is_debt_return,
          "delete",
        );
        const newDelta = getBalanceDelta(
          update.amount,
          accountType,
          !!oldTransaction.is_debt_return,
          "create",
        );
        queryClient.setQueryData(
          ["account-balance", oldTransaction.account_id],
          {
            ...previousBalance,
            balance: previousBalance.balance + oldDelta + newDelta,
          },
        );
      }

      return {
        previousTransactions,
        previousTodayTransactions,
        previousBalance,
        accountId: oldTransaction?.account_id,
        oldTransaction,
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
          context.previousBalance,
        );
      }
    },
    onSuccess: (data, update, context) => {
      // Clear _isPending flag from the updated transaction
      queryClient.setQueriesData<Transaction[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return old;
          return old.map((t) =>
            t.id === update.id ? { ...t, _isPending: false } : t,
          );
        },
      );
      queryClient.setQueriesData<any[]>(
        { queryKey: ["transactions-today"] },
        (old) => {
          if (!old) return old;
          return old.map((t: any) =>
            t.id === update.id ? { ...t, _isPending: false } : t,
          );
        },
      );

      // Show success toast
      const original = context?.oldTransaction;
      toast.success("Transaction updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              if (original) {
                const response = await fetch(
                  `/api/transactions/${original.id}`,
                  {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      date: original.date,
                      amount: original.amount,
                      description: original.description,
                      account_id: original.account_id,
                      category_id: original.category_id,
                      subcategory_id: original.subcategory_id,
                    }),
                  },
                );
                if (!response.ok) throw new Error("Failed to undo");
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
                queryClient.invalidateQueries({
                  queryKey: ["transactions-today"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["account-balance"],
                });
                toast.success("Update undone");
              }
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onSettled: () => {
      // Sync in-memory state to localStorage so the next cold start is instant
      syncTxCacheToLocalStorage(queryClient);
      // Transaction cache updated in onSuccess, mark stale for lazy refetch
      queryClient.invalidateQueries({
        queryKey: ["transactions"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions-today"],
        refetchType: "none",
      });
      // Refetch balance from server to confirm optimistic update
      queryClient.invalidateQueries({
        queryKey: ["account-balance"],
        refetchType: "active",
      });
    },
  });
}
