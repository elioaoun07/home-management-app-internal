import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type PendingSplit = {
  transaction_id: string;
  date: string;
  owner_amount: number;
  owner_description: string;
  category_name: string;
  category_color: string;
};

type CompleteSplitParams = {
  transaction_id: string;
  amount: number;
  description?: string;
  account_id: string;
};

export function usePendingSplits() {
  return useQuery<{ pending_splits: PendingSplit[] }>({
    queryKey: ["pending-splits"],
    queryFn: async () => {
      const res = await fetch("/api/transactions/split-bill");
      if (!res.ok) {
        throw new Error("Failed to fetch pending splits");
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

export function useCompleteSplitBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transaction_id,
      amount,
      description,
      account_id,
    }: CompleteSplitParams) => {
      const res = await fetch("/api/transactions/split-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id,
          amount,
          description,
          account_id,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to complete split bill");
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["pending-splits"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
