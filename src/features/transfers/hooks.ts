// src/features/transfers/hooks.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  amount: number;
  description: string;
  date: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

export interface CreateTransferInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description?: string;
  date?: string;
}

export interface UpdateTransferInput {
  id: string;
  amount?: number;
  description?: string;
  date?: string;
}

// Query keys
export const transferKeys = {
  all: ["transfers"] as const,
  list: (filters?: { start?: string; end?: string }) =>
    [...transferKeys.all, "list", filters] as const,
  detail: (id: string) => [...transferKeys.all, "detail", id] as const,
};

// Fetch transfers
async function fetchTransfers(
  start?: string,
  end?: string,
): Promise<Transfer[]> {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  const url = `/api/transfers${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as Transfer[];
}

// Create transfer
async function createTransfer(input: CreateTransferInput): Promise<Transfer> {
  const res = await fetch("/api/transfers", {
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
  const res = await fetch(`/api/transfers/${id}`, {
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
  const res = await fetch(`/api/transfers/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete transfer");
  }
}

/**
 * Hook to fetch transfers
 */
export function useTransfers(filters?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: transferKeys.list(filters),
    queryFn: () => fetchTransfers(filters?.start, filters?.end),
    staleTime: CACHE_TIMES.BALANCE, // 5 minutes
    refetchOnMount: true,
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
      // Invalidate transfers list
      queryClient.invalidateQueries({ queryKey: transferKeys.all });

      // Invalidate both account balances
      queryClient.invalidateQueries({
        queryKey: ["account-balance", data.from_account_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["account-balance", data.to_account_id],
      });

      toast.success("Transfer completed!", {
        description: `$${data.amount.toFixed(2)} transferred`,
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Transfer failed");
    },
  });
}

/**
 * Hook to update a transfer
 */
export function useUpdateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransfer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      queryClient.invalidateQueries({
        queryKey: ["account-balance", data.from_account_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["account-balance", data.to_account_id],
      });

      toast.success("Transfer updated");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update transfer",
      );
    },
  });
}

/**
 * Hook to delete a transfer
 */
export function useDeleteTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transferKeys.all });
      // Also invalidate all account balances since we don't know which ones were affected
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "account-balance",
      });

      toast.success("Transfer deleted");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete transfer",
      );
    },
  });
}
