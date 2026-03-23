import { isReallyOnline } from "@/lib/connectivityManager";
import { addToQueue } from "@/lib/offlineQueue";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type RecurringPayment = {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  name: string;
  amount: number;
  description: string | null;
  recurrence_type: "daily" | "weekly" | "monthly" | "yearly";
  recurrence_day: number | null;
  next_due_date: string;
  last_processed_date: string | null;
  payment_method: "manual" | "auto";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    name: string;
    type: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
  subcategory?: {
    id: string;
    name: string;
    slug: string;
  };
};

const QUERY_KEY = ["recurring-payments"] as const;

/**
 * OPTIMIZED: Recurring payments with smart caching
 * - 30 minute staleTime
 * - No refetch on mount (uses cached data)
 * - Only refetches when explicitly invalidated
 */
export function useRecurringPayments() {
  return useQuery<RecurringPayment[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/recurring-payments");
      if (!res.ok) throw new Error("Failed to fetch recurring payments");
      const data = await res.json();
      return data.recurring_payments || [];
    },
    staleTime: CACHE_TIMES.RECURRING, // 30 minutes
    refetchOnMount: false, // Don't refetch on mount - use cache
    refetchOnWindowFocus: false,
  });
}

export function useCreateRecurringPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      account_id: string;
      category_id?: string | null;
      subcategory_id?: string | null;
      name: string;
      amount: number;
      description?: string | null;
      recurrence_type: "daily" | "weekly" | "monthly" | "yearly";
      recurrence_day?: number | null;
      next_due_date: string;
      payment_method?: "manual" | "auto";
    }) => {
      const res = await safeFetch("/api/recurring-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      if (!res.ok) throw new Error("Failed to create recurring payment");
      return res.json() as Promise<RecurringPayment>;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Recurring payment created", {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await safeFetch(`/api/recurring-payments/${created.id}`, {
                method: "DELETE",
              });
              queryClient.invalidateQueries({ queryKey: QUERY_KEY });
              toast.success("Recurring payment removed", {
                icon: ToastIcons.delete,
              });
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: () => {
      toast.error("Failed to create recurring payment", {
        icon: ToastIcons.error,
      });
    },
  });
}

export function useUpdateRecurringPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      name?: string;
      amount?: number;
      description?: string | null;
      category_id?: string | null;
      subcategory_id?: string | null;
      recurrence_type?: "daily" | "weekly" | "monthly" | "yearly";
      recurrence_day?: number | null;
      next_due_date?: string;
      is_active?: boolean;
      payment_method?: "manual" | "auto";
    }) => {
      const res = await safeFetch(`/api/recurring-payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update recurring payment");
      return res.json() as Promise<RecurringPayment>;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<RecurringPayment[]>(QUERY_KEY);
      const previousItem = previous?.find((p) => p.id === id);
      return { previousItem };
    },
    onSuccess: (_, variables, context) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const prev = context?.previousItem;
      toast.success("Recurring payment updated", {
        icon: ToastIcons.update,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!prev) return;
            try {
              await safeFetch(`/api/recurring-payments/${variables.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: prev.name,
                  amount: prev.amount,
                  description: prev.description,
                  category_id: prev.category_id,
                  subcategory_id: prev.subcategory_id,
                  recurrence_type: prev.recurrence_type,
                  recurrence_day: prev.recurrence_day,
                  next_due_date: prev.next_due_date,
                  is_active: prev.is_active,
                  payment_method: prev.payment_method,
                }),
              });
              queryClient.invalidateQueries({ queryKey: QUERY_KEY });
              toast.success("Changes reverted", { icon: ToastIcons.update });
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onError: () => {
      toast.error("Failed to update recurring payment", {
        icon: ToastIcons.error,
      });
    },
  });
}

export function useDeleteRecurringPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await safeFetch(`/api/recurring-payments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete recurring payment");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<RecurringPayment[]>(QUERY_KEY);
      const deleted = previous?.find((p) => p.id === id);

      // Optimistically remove from list
      queryClient.setQueryData<RecurringPayment[]>(QUERY_KEY, (old = []) =>
        old.filter((p) => p.id !== id),
      );

      return { deleted };
    },
    onSuccess: (_, __, context) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      const deleted = context?.deleted;
      toast.success("Recurring payment deleted", {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (!deleted) return;
            try {
              await safeFetch("/api/recurring-payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  account_id: deleted.account_id,
                  category_id: deleted.category_id,
                  subcategory_id: deleted.subcategory_id,
                  name: deleted.name,
                  amount: deleted.amount,
                  description: deleted.description,
                  recurrence_type: deleted.recurrence_type,
                  recurrence_day: deleted.recurrence_day,
                  next_due_date: deleted.next_due_date,
                  payment_method: deleted.payment_method,
                }),
              });
              queryClient.invalidateQueries({ queryKey: QUERY_KEY });
              toast.success("Recurring payment restored", {
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
      // Rollback optimistic removal
      if (context?.deleted) {
        queryClient.setQueryData<RecurringPayment[]>(QUERY_KEY, (old = []) => [
          ...old,
          context.deleted!,
        ]);
      }
      toast.error("Failed to delete recurring payment", {
        icon: ToastIcons.error,
      });
    },
  });
}

export function useConfirmPayment() {
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
      // Check real connectivity (not just navigator.onLine which can lie after WiFi toggle)
      const offline = !isReallyOnline();

      if (offline) {
        await addToQueue({
          feature: "recurring",
          operation: "confirm",
          endpoint: `/api/recurring-payments/${id}`,
          method: "POST",
          body: {
            amount,
            description,
            date,
            account_id,
            category_id,
            subcategory_id,
          },
          metadata: {
            label: `Confirm payment${description ? ` "${description}"` : ""}`,
          },
        });
        return { _offline: true };
      }
      const res = await safeFetch(`/api/recurring-payments/${id}`, {
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
      if (!res.ok) throw new Error("Failed to confirm payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    },
    onError: () => {
      toast.error("Failed to confirm payment", { icon: ToastIcons.error });
    },
  });
}
