// src/features/debts/useDebts.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateDebtDTO, Debt, DebtStatus, SettleDebtDTO } from "./types";

// Query keys
export const debtKeys = {
  all: ["debts"] as const,
  withStatus: (status?: DebtStatus) =>
    status ? (["debts", { status }] as const) : (["debts"] as const),
};

// Fetch debts
async function fetchDebts(status?: DebtStatus): Promise<Debt[]> {
  const params = status ? `?status=${status}` : "";
  const res = await fetch(`/api/debts${params}`);
  if (!res.ok) throw new Error("Failed to fetch debts");
  const data = await res.json();
  return data.debts || [];
}

/**
 * Hook to fetch debts with optional status filter
 */
export function useDebts(status?: DebtStatus) {
  return useQuery({
    queryKey: debtKeys.withStatus(status),
    queryFn: () => fetchDebts(status),
    staleTime: CACHE_TIMES.BALANCE, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
}

/**
 * Hook to get open debt count (for badge display)
 */
export function useOpenDebtCount() {
  const { data: debts = [] } = useDebts("open");
  return debts.length;
}

/**
 * Hook to get total outstanding debt amount
 */
export function useOutstandingDebtAmount() {
  const { data: debts = [] } = useDebts("open");
  return debts.reduce(
    (sum, d) => sum + (Number(d.original_amount) - Number(d.returned_amount)),
    0,
  );
}

/**
 * Create a new debt with optimistic updates
 */
export function useCreateDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDebtDTO) => {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create debt");
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Debt created for ${data.debt.debtor_name}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create debt");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: debtKeys.all });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    },
  });
}

/**
 * Settle a debt (partial or full payment) with optimistic updates
 */
export function useSettleDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      debtId,
      data,
    }: {
      debtId: string;
      data: SettleDebtDTO;
    }) => {
      const res = await fetch(`/api/debts/${debtId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to settle debt");
      }

      return res.json();
    },
    onMutate: async ({ debtId, data }) => {
      await queryClient.cancelQueries({ queryKey: debtKeys.all });

      const previousDebts = queryClient.getQueriesData<Debt[]>({
        queryKey: debtKeys.all,
      });

      // Optimistically update the debt
      queryClient.setQueriesData<Debt[]>({ queryKey: debtKeys.all }, (old) => {
        if (!old) return old;
        return old.map((d) => {
          if (d.id !== debtId) return d;
          const newReturned = Number(d.returned_amount) + data.amount_returned;
          const isFullyClosed = newReturned >= Number(d.original_amount) - 0.01;
          return {
            ...d,
            returned_amount: Math.min(newReturned, Number(d.original_amount)),
            status: isFullyClosed ? ("closed" as const) : d.status,
            closed_at: isFullyClosed ? new Date().toISOString() : d.closed_at,
            updated_at: new Date().toISOString(),
          };
        });
      });

      return { previousDebts };
    },
    onError: (err, _, context) => {
      // Rollback
      if (context?.previousDebts) {
        context.previousDebts.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(err instanceof Error ? err.message : "Failed to settle debt");
    },
    onSuccess: (data) => {
      if (data.settlement.is_fully_closed) {
        toast.success("Debt fully settled! 🎉");
      } else {
        toast.success(
          `$${data.settlement.amount_settled.toFixed(2)} received. $${data.settlement.remaining.toFixed(2)} remaining.`,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: debtKeys.all });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["balance-history"] });
    },
  });
}

/**
 * Unarchive a debt (move from archived back to open)
 */
export function useUnarchiveDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debtId: string) => {
      const res = await fetch(`/api/debts/${debtId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unarchive" }),
      });

      if (!res.ok) throw new Error("Failed to unarchive debt");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Debt unarchived — you can now settle it");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: debtKeys.all });
    },
  });
}

/**
 * Delete a debt
 */
export function useDeleteDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debtId: string) => {
      const res = await fetch(`/api/debts/${debtId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete debt");
      return res.json();
    },
    onMutate: async (debtId) => {
      await queryClient.cancelQueries({ queryKey: debtKeys.all });

      const previousDebts = queryClient.getQueriesData<Debt[]>({
        queryKey: debtKeys.all,
      });

      queryClient.setQueriesData<Debt[]>({ queryKey: debtKeys.all }, (old) => {
        if (!old) return old;
        return old.filter((d) => d.id !== debtId);
      });

      return { previousDebts };
    },
    onError: (_, __, context) => {
      if (context?.previousDebts) {
        context.previousDebts.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error("Failed to delete debt");
    },
    onSuccess: () => {
      toast.success("Debt deleted");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: debtKeys.all });
    },
  });
}
