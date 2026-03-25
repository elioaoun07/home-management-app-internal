// src/features/transfers/hooks.ts
"use client";

import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

export interface Transfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  from_account_name: string;
  to_account_name: string;
  from_account_type: "income" | "expense" | "saving";
  to_account_type: "income" | "expense" | "saving";
  from_account_user_id: string | null;
  to_account_user_id: string | null;
  amount: number;
  description: string;
  date: string;
  transfer_type: "self" | "household";
  recipient_user_id: string | null;
  fee_amount: number;
  returned_amount: number;
  household_link_id: string | null;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  is_recipient: boolean;
}

export interface CreateTransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description?: string;
  date?: string;
  transfer_type?: "self" | "household";
  recipient_user_id?: string;
  fee_amount?: number;
  returned_amount?: number;
}

export interface UpdateTransferInput {
  id: string;
  amount?: number;
  description?: string;
  date?: string;
  fee_amount?: number;
  returned_amount?: number;
}

// Query keys
export const transferKeys = {
  all: ["transfers"] as const,
  list: (filters?: { start?: string; end?: string }) =>
    [...transferKeys.all, "list", filters] as const,
  detail: (id: string) => [...transferKeys.all, "detail", id] as const,
};

// --------------- localStorage transfer cache ---------------
const TR_CACHE_PREFIX = "tr-cache-";
const TR_CACHE_LATEST_KEY = "tr-cache-latest"; // Stable alias — written for every single-day fetch
const TR_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function getTrCacheKey(start?: string, end?: string) {
  return `${TR_CACHE_PREFIX}${start || "all"}_${end || "all"}`;
}

/** Remove oldest date-keyed cache entries when there are more than 7. */
function cleanupOldTrCaches() {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith(TR_CACHE_PREFIX) && k !== TR_CACHE_LATEST_KEY,
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

function readTrCache(
  start?: string,
  end?: string,
): { data: Transfer[]; ts: number } | undefined {
  try {
    // Try exact date-range match first
    const raw = localStorage.getItem(getTrCacheKey(start, end));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > TR_CACHE_MAX_AGE) {
        localStorage.removeItem(getTrCacheKey(start, end));
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
      const aliasRaw = localStorage.getItem(TR_CACHE_LATEST_KEY);
      if (aliasRaw) {
        const parsed = JSON.parse(aliasRaw);
        if (Date.now() - parsed.ts > TR_CACHE_MAX_AGE) return undefined;
        return { data: parsed.data, ts: 0 };
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function writeTrCache(
  start: string | undefined,
  end: string | undefined,
  data: Transfer[],
) {
  try {
    const trimmed = data.slice(0, 300);
    const payload = JSON.stringify({ data: trimmed, ts: Date.now() });
    localStorage.setItem(getTrCacheKey(start, end), payload);
    // Also write stable alias for single-day ranges so the next cold start
    // (new day) can show last-known data instantly while fresh data loads.
    if (start && end && start === end) {
      localStorage.setItem(TR_CACHE_LATEST_KEY, payload);
    }
    // Prevent localStorage bloat from accumulating old date-keyed entries
    cleanupOldTrCaches();
  } catch {
    /* quota exceeded — ignore */
  }
}

/**
 * Sync all in-memory transfer queries to localStorage so mutations
 * (create/update/delete) are reflected in the persistent cache immediately.
 * Call this in mutation onSettled callbacks.
 */
function syncTrCacheToLocalStorage(queryClient: ReturnType<typeof useQueryClient>) {
  const allQueries = queryClient.getQueriesData<Transfer[]>({
    queryKey: transferKeys.all,
  });
  for (const [key, data] of allQueries) {
    if (data && Array.isArray(key) && key.length >= 3 && key[1] === "list") {
      const filters = key[2] as { start?: string; end?: string } | undefined;
      writeTrCache(filters?.start, filters?.end, data);
    }
  }
}

// Fetch transfers
async function fetchTransfers(
  start?: string,
  end?: string,
): Promise<Transfer[]> {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  const url = `/api/transfers${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url); // GET — regular fetch is fine

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as Transfer[];
}

// Create transfer
async function createTransfer(input: CreateTransferInput): Promise<Transfer> {
  const res = await safeFetch("/api/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to create transfer");
  }

  return res.json();
}

// Update transfer
async function updateTransfer(input: UpdateTransferInput): Promise<Transfer> {
  const { id, ...data } = input;
  const res = await safeFetch(`/api/transfers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update transfer");
  }

  return res.json();
}

// Delete transfer
async function deleteTransfer(id: string): Promise<void> {
  const res = await safeFetch(`/api/transfers/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete transfer");
  }
}

/**
 * Hook to fetch transfers with persistent caching
 */
export function useTransfers(filters?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: transferKeys.list(filters),
    queryFn: async () => {
      const data = await fetchTransfers(filters?.start, filters?.end);
      writeTrCache(filters?.start, filters?.end, data);
      return data;
    },
    initialData: () => {
      if (typeof window === "undefined") return undefined;
      return readTrCache(filters?.start, filters?.end)?.data;
    },
    initialDataUpdatedAt: () => {
      if (typeof window === "undefined") return undefined;
      return readTrCache(filters?.start, filters?.end)?.ts;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes — history rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook to create a transfer
 */
export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransfer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({
        queryKey: ["account-balance", data.from_account_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["account-balance", data.to_account_id],
      });

      toast.success("Transfer completed!", {
        icon: ToastIcons.create,
        description: `$${data.amount.toFixed(2)} transferred`,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteTransfer(data.id);
              queryClient.invalidateQueries({ queryKey: transferKeys.all });
              queryClient.invalidateQueries({ queryKey: ["account-balance"] });
              toast.success("Transfer reversed", { icon: ToastIcons.delete });
            } catch {
              toast.error("Failed to undo transfer");
            }
          },
        },
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Transfer failed", {
        icon: ToastIcons.error,
      });
    },
  });
}

/**
 * Hook to update a transfer with optimistic UI
 */
export function useUpdateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransfer,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: transferKeys.all });

      const previousQueries = queryClient.getQueriesData<Transfer[]>({
        queryKey: transferKeys.all,
      });

      // Find the previous state of this transfer for undo
      let previousTransfer: Transfer | undefined;
      for (const [, data] of previousQueries) {
        previousTransfer = data?.find((t) => t.id === variables.id);
        if (previousTransfer) break;
      }

      queryClient.setQueriesData<Transfer[]>(
        { queryKey: transferKeys.all },
        (old) => {
          if (!old) return old;
          return old.map((t) =>
            t.id === variables.id ? { ...t, ...variables } : t,
          );
        },
      );

      return { previousQueries, previousTransfer };
    },
    onSuccess: (_, variables, context) => {
      const prev = context?.previousTransfer;
      toast.success("Transfer updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!prev) return;
            try {
              await updateTransfer({
                id: variables.id,
                amount: prev.amount,
                description: prev.description,
                date: prev.date,
                fee_amount: prev.fee_amount,
                returned_amount: prev.returned_amount,
              });
              queryClient.invalidateQueries({ queryKey: transferKeys.all });
              toast.success("Transfer reverted", { icon: ToastIcons.update });
            } catch {
              toast.error("Failed to undo transfer update");
            }
          },
        },
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(
        error instanceof Error ? error.message : "Failed to update transfer",
        { icon: ToastIcons.error },
      );
    },
    onSettled: (_data, _error, variables) => {
      // Sync in-memory state to localStorage so the next cold start is instant
      syncTrCacheToLocalStorage(queryClient);
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "account-balance",
      });
    },
  });
}

/**
 * Hook to delete a transfer with optimistic UI
 */
export function useDeleteTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransfer,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: transferKeys.all });

      const previousQueries = queryClient.getQueriesData<Transfer[]>({
        queryKey: transferKeys.all,
      });

      // Find the transfer being deleted before removing it
      let deletedTransfer: Transfer | undefined;
      for (const [, data] of previousQueries) {
        deletedTransfer = data?.find((t) => t.id === id);
        if (deletedTransfer) break;
      }

      // Optimistically remove the transfer from all lists
      queryClient.setQueriesData<Transfer[]>(
        { queryKey: transferKeys.all },
        (old) => {
          if (!old) return old;
          return old.filter((t) => t.id !== id);
        },
      );

      return { previousQueries, deletedTransfer };
    },
    onSuccess: (_, __, context) => {
      const deleted = context?.deletedTransfer;
      toast.success("Transfer deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!deleted) return;
            try {
              await createTransfer({
                from_account_id: deleted.from_account_id,
                to_account_id: deleted.to_account_id,
                amount: deleted.amount,
                description: deleted.description,
                date: deleted.date,
                transfer_type: deleted.transfer_type,
                recipient_user_id: deleted.recipient_user_id ?? undefined,
                fee_amount: deleted.fee_amount,
                returned_amount: deleted.returned_amount,
              });
              queryClient.invalidateQueries({ queryKey: transferKeys.all });
              queryClient.invalidateQueries({ queryKey: ["account-balance"] });
              toast.success("Transfer restored", { icon: ToastIcons.create });
            } catch {
              toast.error("Failed to undo transfer deletion");
            }
          },
        },
      });
    },
    onError: (error, _id, context) => {
      // Rollback
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(
        error instanceof Error ? error.message : "Failed to delete transfer",
        { icon: ToastIcons.error },
      );
    },
    onSettled: () => {
      // Sync in-memory state to localStorage so the next cold start is instant
      syncTrCacheToLocalStorage(queryClient);
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "account-balance",
      });
    },
  });
}
