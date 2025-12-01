"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { qk } from "@/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type DraftTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  voice_transcript: string | null;
  confidence_score: number | null;
  inserted_at: string;
  account_id: string;
  accounts: { name: string };
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
};

type DraftConfirmInput = {
  id: string;
  amount: string;
  category_id: string;
  subcategory_id?: string;
  description?: string;
  date: string;
  account_id: string;
};

async function fetchDrafts(): Promise<DraftTransaction[]> {
  const res = await fetch("/api/drafts");
  if (!res.ok) {
    throw new Error("Failed to fetch drafts");
  }
  const data = await res.json();
  return data.drafts || [];
}

/**
 * OPTIMIZED: Drafts with smart caching
 * - 1 minute staleTime (may be added frequently)
 * - Refetch on window focus (user might add from another device)
 */
export function useDrafts() {
  return useQuery({
    queryKey: qk.drafts(),
    queryFn: fetchDrafts,
    staleTime: CACHE_TIMES.DRAFTS, // 1 minute
    refetchOnWindowFocus: true,
    refetchOnMount: "always", // Always check for new drafts
  });
}

export function useDraftCount() {
  const { data: drafts = [] } = useDrafts();
  return drafts.length;
}

/**
 * Delete a draft with optimistic updates
 * Draft disappears instantly, rolls back on error
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete draft");
      }

      return draftId;
    },
    onMutate: async (draftId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: qk.drafts() });

      // Snapshot the previous value
      const previousDrafts = queryClient.getQueryData<DraftTransaction[]>(
        qk.drafts()
      );

      // Find the draft to get its amount for balance update
      const deletedDraft = previousDrafts?.find((d) => d.id === draftId);
      const previousBalance = deletedDraft
        ? (queryClient.getQueryData([
            "account-balance",
            deletedDraft.account_id,
          ]) as
            | { balance: number; pending_drafts?: number; draft_count?: number }
            | undefined)
        : undefined;

      // Optimistically remove from drafts
      queryClient.setQueryData<DraftTransaction[]>(qk.drafts(), (old) => {
        if (!old) return old;
        return old.filter((d) => d.id !== draftId);
      });

      // Optimistically update balance (reduce pending drafts)
      if (previousBalance && deletedDraft) {
        queryClient.setQueryData(["account-balance", deletedDraft.account_id], {
          ...previousBalance,
          pending_drafts:
            (previousBalance.pending_drafts || 0) - deletedDraft.amount,
          draft_count: Math.max(0, (previousBalance.draft_count || 1) - 1),
        });
      }

      return {
        previousDrafts,
        previousBalance,
        accountId: deletedDraft?.account_id,
      };
    },
    onError: (err, draftId, context) => {
      // Rollback on error
      if (context?.previousDrafts) {
        queryClient.setQueryData(qk.drafts(), context.previousDrafts);
      }
      if (context?.previousBalance && context?.accountId) {
        queryClient.setQueryData(
          ["account-balance", context.accountId],
          context.previousBalance
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.drafts() });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    },
  });
}

/**
 * Confirm a draft (convert to transaction) with optimistic updates
 * Draft disappears instantly and transaction appears
 */
export function useConfirmDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DraftConfirmInput) => {
      const { id, ...data } = input;
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to confirm draft");
      }

      return res.json();
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches for ALL queries
      await queryClient.cancelQueries({ queryKey: qk.drafts() });
      await queryClient.cancelQueries({
        queryKey: ["transactions"],
        exact: false,
      });
      await queryClient.cancelQueries({ queryKey: ["account-balance"] });

      // Snapshot previous values
      const previousDrafts = queryClient.getQueryData<DraftTransaction[]>(
        qk.drafts()
      );
      const previousTransactions = queryClient.getQueriesData<any[]>({
        queryKey: ["transactions"],
      });

      // Find the draft being confirmed
      const confirmedDraft = previousDrafts?.find((d) => d.id === input.id);
      const previousBalance = queryClient.getQueryData([
        "account-balance",
        input.account_id,
      ]) as
        | { balance: number; pending_drafts?: number; draft_count?: number }
        | undefined;

      // Optimistically remove from drafts
      queryClient.setQueryData<DraftTransaction[]>(qk.drafts(), (old) => {
        if (!old) return old;
        return old.filter((d) => d.id !== input.id);
      });

      // Optimistically add to ALL transaction queries
      const optimisticTransaction = {
        id: `temp-${Date.now()}`,
        date: input.date,
        amount: parseFloat(input.amount),
        description: input.description || null,
        account_id: input.account_id,
        category: null,
        subcategory: null,
        category_id: input.category_id,
        subcategory_id: input.subcategory_id || null,
        inserted_at: new Date().toISOString(),
      };

      queryClient.setQueriesData<any[]>(
        { queryKey: ["transactions"] },
        (old) => {
          if (!old) return [optimisticTransaction];
          return [optimisticTransaction, ...old];
        }
      );

      // Optimistically update balance
      if (previousBalance) {
        const amount = parseFloat(input.amount);
        const draftAmount = confirmedDraft?.amount || amount;
        queryClient.setQueryData(["account-balance", input.account_id], {
          ...previousBalance,
          balance: previousBalance.balance - amount,
          pending_drafts: Math.max(
            0,
            (previousBalance.pending_drafts || 0) - draftAmount
          ),
          draft_count: Math.max(0, (previousBalance.draft_count || 1) - 1),
        });
      }

      return {
        previousDrafts,
        previousTransactions,
        previousBalance,
        accountId: input.account_id,
      };
    },
    onError: (err, input, context) => {
      // Rollback on error
      if (context?.previousDrafts) {
        queryClient.setQueryData(qk.drafts(), context.previousDrafts);
      }
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousBalance && context?.accountId) {
        queryClient.setQueryData(
          ["account-balance", context.accountId],
          context.previousBalance
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.drafts() });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
