"use client";

import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import type {
  AiBudgetSuggestion,
  BudgetAllocation,
  BudgetCategoryView,
  BudgetSummary,
  BudgetWeek,
  CreateBudgetAllocationInput,
} from "@/types/budgetAllocation";
import type { Account } from "@/types/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BudgetResponse {
  summary: BudgetSummary;
  hasPartner: boolean;
  accounts: Account[];
}

const BUDGET_KEY = "budget-allocations";

async function fetchBudgetAllocations(
  month?: string,
  accountId?: string,
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
  input: CreateBudgetAllocationInput,
): Promise<BudgetAllocation> {
  const res = await safeFetch("/api/budget-allocations", {
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
  const res = await safeFetch(`/api/budget-allocations?id=${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to delete budget allocation");
  }
}

/**
 * Fetch budget allocations with spending data.
 * Overrides global refetchOnMount: false so navigating back to this page
 * always fetches fresh data from the server.
 */
export function useBudgetAllocations(month?: string, accountId?: string) {
  return useQuery({
    queryKey: [BUDGET_KEY, month, accountId],
    queryFn: () => fetchBudgetAllocations(month, accountId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: "always", // override global false — budget data must be fresh on every mount
  });
}

/**
 * Helper: apply a budget amount change optimistically to the cached summary.
 * Works for both parent-category and subcategory budget edits.
 */
function applyBudgetOptimistic(
  old: BudgetResponse | undefined,
  input: CreateBudgetAllocationInput,
): BudgetResponse | undefined {
  if (!old) return old;

  const updatedCategories: BudgetCategoryView[] = old.summary.categories.map(
    (cat) => {
      // Subcategory budget change
      if (input.subcategory_id && cat.category_id === input.category_id) {
        const updatedSubs = cat.subcategories?.map((sub) =>
          sub.subcategory_id === input.subcategory_id
            ? { ...sub, total_budget: input.monthly_budget }
            : sub,
        );
        return { ...cat, subcategories: updatedSubs };
      }
      // Parent category budget change
      if (!input.subcategory_id && cat.category_id === input.category_id) {
        return { ...cat, total_budget: input.monthly_budget };
      }
      return cat;
    },
  );

  const newTotalBudget = updatedCategories.reduce(
    (sum, c) => sum + c.total_budget,
    0,
  );

  return {
    ...old,
    summary: {
      ...old.summary,
      categories: updatedCategories,
      total_budget: newTotalBudget,
      total_remaining: newTotalBudget - old.summary.total_spent,
      unallocated: old.summary.income_balance - newTotalBudget,
    },
  };
}

/**
 * Save or update a budget allocation.
 *
 * Uses optimistic updates + cancelQueries to avoid stale-refetch races:
 *   onMutate  → cancel in-flight fetches, apply optimistic budget in cache
 *   onError   → rollback to previous cache snapshot
 *   onSuccess → toast with undo
 *   onSettled → always invalidate to reconcile with real server data
 */
export function useSaveBudgetAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveBudgetAllocation,

    onMutate: async (input) => {
      // 1. Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: [BUDGET_KEY] });

      // 2. Snapshot every active budget query for rollback
      const previousQueries = queryClient.getQueriesData<BudgetResponse>({
        queryKey: [BUDGET_KEY],
      });

      // 3. Optimistically update all matching budget queries
      queryClient.setQueriesData<BudgetResponse>(
        { queryKey: [BUDGET_KEY] },
        (old) => applyBudgetOptimistic(old, input),
      );

      return { previousQueries };
    },

    onError: (_err, _input, context) => {
      // Rollback every budget query to its pre-mutation snapshot
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          if (data) queryClient.setQueryData(key, data);
        }
      }
      toast.error("Failed to save budget allocation", {
        icon: ToastIcons.error,
      });
    },

    onSuccess: (data) => {
      toast.success("Budget saved", {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await safeFetch(`/api/budget-allocations?id=${data.id}`, {
                method: "DELETE",
              });
              queryClient.invalidateQueries({ queryKey: [BUDGET_KEY] });
              toast.success("Budget allocation removed", {
                icon: ToastIcons.delete,
              });
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },

    // Always refetch from server after mutation settles (success OR error)
    // to reconcile the optimistic cache with the real DB state.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGET_KEY] });
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
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [BUDGET_KEY] });
      toast.success("Budget allocation removed", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            toast.error("Cannot restore — please re-add the budget allocation");
          },
        },
      });
    },
    onError: () => {
      toast.error("Failed to delete budget allocation", {
        icon: ToastIcons.error,
      });
    },
  });
}

// ===== AI Budget Suggestion Hooks =====

const AI_BUDGET_KEY = "ai-budget-suggestion";

interface AiBudgetResponse {
  suggestion: AiBudgetSuggestion | null;
  weeksWithSuggestions: string[];
}

async function fetchAiBudgetSuggestion(
  month: string,
  week: BudgetWeek,
): Promise<AiBudgetResponse> {
  const params = new URLSearchParams({ month, week });
  const res = await fetch(
    `/api/budget-allocations/ai-suggest?${params.toString()}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch AI suggestion");
  }
  return res.json();
}

/**
 * Fetch stored AI budget suggestion for a given month + week.
 * Also returns which weeks have suggestions (for indicators).
 */
export function useAiBudgetSuggestion(month?: string, week?: BudgetWeek) {
  return useQuery({
    queryKey: [AI_BUDGET_KEY, month, week],
    queryFn: () => fetchAiBudgetSuggestion(month!, week!),
    enabled: !!month && !!week,
    staleTime: 10 * 60 * 1000, // 10 minutes — suggestions rarely change
    refetchOnWindowFocus: false,
  });
}

interface GenerateAiInput {
  month: string;
  week: BudgetWeek;
  force?: boolean;
}

interface GenerateAiResponse {
  exists?: boolean;
  suggestion: AiBudgetSuggestion;
  generated?: boolean;
}

/**
 * Generate (or re-generate) an AI budget suggestion for a specific month + week.
 * Returns { exists: true } if suggestion already exists (and force wasn't set).
 */
export function useGenerateAiBudgetSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateAiInput): Promise<GenerateAiResponse> => {
      const res = await safeFetch("/api/budget-allocations/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        timeoutMs: 60_000, // Gemini AI calls can take 10-30s
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate AI suggestion");
      }
      return res.json();
    },
    onSuccess: (data, input) => {
      // Invalidate the AI suggestion query for this month/week
      queryClient.invalidateQueries({
        queryKey: [AI_BUDGET_KEY, input.month, input.week],
      });
      // Also invalidate all AI queries for this month (week indicators)
      queryClient.invalidateQueries({
        queryKey: [AI_BUDGET_KEY, input.month],
      });

      if (data.generated) {
        toast.success("AI budget suggestion generated", {
          icon: ToastIcons.create,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: async () => {
              // Delete the suggestion
              try {
                await safeFetch(
                  `/api/budget-allocations/ai-suggest?id=${data.suggestion.id}`,
                  { method: "DELETE" },
                );
                queryClient.invalidateQueries({
                  queryKey: [AI_BUDGET_KEY, input.month],
                });
                toast.success("AI suggestion removed");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
      }
    },
    onError: () => {
      toast.error("Failed to generate AI suggestion", {
        icon: ToastIcons.error,
      });
    },
  });
}
