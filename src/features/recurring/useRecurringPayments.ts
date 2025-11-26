import { CACHE_TIMES } from "@/lib/queryConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    icon: string | null;
    color: string | null;
  };
  subcategory?: {
    id: string;
    name: string;
    slug: string;
  };
};

/**
 * OPTIMIZED: Recurring payments with smart caching
 * - 30 minute staleTime
 * - No refetch on mount (uses cached data)
 * - Only refetches when explicitly invalidated
 */
export function useRecurringPayments() {
  return useQuery<RecurringPayment[]>({
    queryKey: ["recurring-payments"],
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
    }) => {
      const res = await fetch("/api/recurring-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      if (!res.ok) throw new Error("Failed to create recurring payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
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
    }) => {
      const res = await fetch(`/api/recurring-payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update recurring payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
    },
  });
}

export function useDeleteRecurringPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-payments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete recurring payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
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
    }: {
      id: string;
      amount?: number;
      description?: string;
      date?: string;
    }) => {
      const res = await fetch(`/api/recurring-payments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description, date }),
      });
      if (!res.ok) throw new Error("Failed to confirm payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    },
  });
}
