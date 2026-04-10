"use client";

import { invalidateAccountData } from "@/lib/queryInvalidation";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface FuturePayment {
  id: string;
  user_id: string;
  date: string;
  scheduled_date: string;
  amount: number;
  description: string;
  category_id: string | null;
  subcategory_id: string | null;
  account_id: string;
  is_private: boolean;
  accounts?: { name: string };
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
}

const FUTURE_PAYMENTS_KEY = ["future-payments"] as const;

export function useFuturePayments() {
  return useQuery<FuturePayment[]>({
    queryKey: FUTURE_PAYMENTS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/future-payments");
      if (!res.ok) throw new Error("Failed to fetch future payments");
      const data = await res.json();
      return data.payments || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useConfirmFuturePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      description,
      date,
      account_id,
      category_id,
      subcategory_id,
    }: {
      id: string;
      amount?: number;
      description?: string;
      date?: string;
      account_id?: string;
      category_id?: string | null;
      subcategory_id?: string | null;
    }) => {
      const res = await safeFetch(`/api/future-payments/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description,
          date,
          account_id,
          category_id,
          subcategory_id,
        }),
      });
      if (!res.ok) throw new Error("Failed to confirm future payment");
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: FUTURE_PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      const accountId = result?.transaction?.account_id;
      invalidateAccountData(queryClient, accountId);
    },
    onError: () => {
      toast.error("Failed to confirm payment", { icon: ToastIcons.error });
    },
  });
}

export function useDeleteFuturePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await safeFetch(`/api/drafts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete future payment");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: FUTURE_PAYMENTS_KEY });
      const previous =
        queryClient.getQueryData<FuturePayment[]>(FUTURE_PAYMENTS_KEY);
      const deleted = previous?.find((p) => p.id === id);

      queryClient.setQueryData<FuturePayment[]>(
        FUTURE_PAYMENTS_KEY,
        (old = []) => old.filter((p) => p.id !== id),
      );

      return { deleted };
    },
    onSuccess: (_, __, context) => {
      queryClient.invalidateQueries({ queryKey: FUTURE_PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["drafts"] });
      const deleted = context?.deleted;
      toast.success("Future payment deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!deleted) return;
            try {
              await safeFetch("/api/drafts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  account_id: deleted.account_id,
                  amount: deleted.amount,
                  category_id: deleted.category_id,
                  subcategory_id: deleted.subcategory_id,
                  description: deleted.description || "",
                  date: deleted.date,
                  scheduled_date: deleted.scheduled_date,
                }),
              });
              queryClient.invalidateQueries({
                queryKey: FUTURE_PAYMENTS_KEY,
              });
              toast.success("Future payment restored", {
                icon: ToastIcons.create,
              });
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: (_err, _id, context) => {
      if (context?.deleted) {
        queryClient.setQueryData<FuturePayment[]>(
          FUTURE_PAYMENTS_KEY,
          (old = []) => [...old, context.deleted!],
        );
      }
      toast.error("Failed to delete future payment", {
        icon: ToastIcons.error,
      });
    },
  });
}
