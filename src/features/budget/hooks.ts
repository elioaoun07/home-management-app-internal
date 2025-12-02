"use client";

import type {
  BudgetAllocation,
  BudgetSummary,
  CreateBudgetAllocationInput,
} from "@/types/budgetAllocation";
import type { Account } from "@/types/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface BudgetResponse {
  summary: BudgetSummary;
  hasPartner: boolean;
  accounts: Account[];
}

async function fetchBudgetAllocations(
  month?: string,
  accountId?: string
): Promise<BudgetResponse> {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (accountId) params.set("accountId", accountId);

  const res = await fetch(`/api/budget-allocations?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch budget allocations");
  }
  return res.json();
}

async function saveBudgetAllocation(
  input: CreateBudgetAllocationInput
): Promise<BudgetAllocation> {
  const res = await fetch("/api/budget-allocations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to save budget allocation");
  }
  return res.json();
}

async function deleteBudgetAllocation(id: string): Promise<void> {
  const res = await fetch(`/api/budget-allocations?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete budget allocation");
  }
}

/**
 * Fetch budget allocations with spending data
 */
export function useBudgetAllocations(month?: string, accountId?: string) {
  return useQuery({
    queryKey: ["budget-allocations", month, accountId],
    queryFn: () => fetchBudgetAllocations(month, accountId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Save or update a budget allocation
 */
export function useSaveBudgetAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveBudgetAllocation,
    onSuccess: () => {
      // Invalidate budget queries to refetch
      queryClient.invalidateQueries({ queryKey: ["budget-allocations"] });
    },
  });
}

/**
 * Delete a budget allocation
 */
export function useDeleteBudgetAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBudgetAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-allocations"] });
    },
  });
}
