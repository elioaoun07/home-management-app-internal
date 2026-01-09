// src/features/future-purchases/hooks.ts
"use client";

import type {
  CreateFuturePurchaseInput,
  FuturePurchase,
  SavingsAnalysis,
  SpendingPattern,
  UpdateFuturePurchaseInput,
} from "@/types/futurePurchase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const QUERY_KEY = "future-purchases";

// Fetch all future purchases
async function fetchFuturePurchases(
  status?: string
): Promise<FuturePurchase[]> {
  const url = status
    ? `/api/future-purchases?status=${status}`
    : "/api/future-purchases";
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Fetch single future purchase
async function fetchFuturePurchase(id: string): Promise<FuturePurchase> {
  const res = await fetch(`/api/future-purchases/${id}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Fetch analysis for a purchase
async function fetchPurchaseAnalysis(id: string): Promise<{
  purchase: FuturePurchase;
  analysis: SavingsAnalysis;
  spendingPattern: SpendingPattern;
}> {
  const res = await fetch(`/api/future-purchases/${id}/analysis`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Fetch spending pattern analysis
async function fetchSpendingAnalysis(): Promise<SpendingPattern> {
  const res = await fetch("/api/future-purchases/spending-analysis");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

// Create future purchase
async function createFuturePurchase(
  input: CreateFuturePurchaseInput
): Promise<FuturePurchase> {
  const res = await fetch("/api/future-purchases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = "Failed to create purchase goal";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// Update future purchase
async function updateFuturePurchase(
  input: UpdateFuturePurchaseInput
): Promise<FuturePurchase> {
  const { id, ...data } = input;
  const res = await fetch(`/api/future-purchases/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let msg = "Failed to update purchase goal";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// Delete future purchase
async function deleteFuturePurchase(id: string): Promise<void> {
  const res = await fetch(`/api/future-purchases/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    let msg = "Failed to delete purchase goal";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
}

// Allocate savings to a purchase
async function allocateSavings(
  id: string,
  amount: number,
  month?: string
): Promise<FuturePurchase> {
  const res = await fetch(`/api/future-purchases/${id}/allocate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, month }),
  });
  if (!res.ok) {
    let msg = "Failed to allocate savings";
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// --- Query Hooks ---

export function useFuturePurchases(status?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, { status }],
    queryFn: () => fetchFuturePurchases(status),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useFuturePurchase(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => fetchFuturePurchase(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePurchaseAnalysis(id: string) {
  return useQuery({
    queryKey: [QUERY_KEY, id, "analysis"],
    queryFn: () => fetchPurchaseAnalysis(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10, // 10 minutes - analysis is more expensive
  });
}

export function useSpendingAnalysis() {
  return useQuery({
    queryKey: [QUERY_KEY, "spending-analysis"],
    queryFn: fetchSpendingAnalysis,
    staleTime: 1000 * 60 * 15, // 15 minutes - spending patterns don't change frequently
  });
}

// --- Mutation Hooks ---

export function useCreateFuturePurchase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: createFuturePurchase,
    onSuccess: (created) => {
      toast.success(`"${created.name}" goal created!`, {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteFuturePurchase(created.id);
              qc.invalidateQueries({ queryKey: [QUERY_KEY] });
              toast.success("Goal creation undone");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create purchase goal");
    },
  });
}

export function useUpdateFuturePurchase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateFuturePurchase,
    onMutate: async (update) => {
      await qc.cancelQueries({ queryKey: [QUERY_KEY] });

      const previous = qc.getQueryData<FuturePurchase[]>([QUERY_KEY, {}]);

      // Store the original item for undo
      const originalItem = previous?.find((p) => p.id === update.id);

      // Optimistic update
      qc.setQueryData<FuturePurchase[]>([QUERY_KEY, {}], (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === update.id ? { ...p, ...update } : p));
      });

      return { previous, originalItem };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        qc.setQueryData([QUERY_KEY, {}], context.previous);
      }
      toast.error(err.message || "Failed to update purchase goal");
    },
    onSuccess: (updated, _, context) => {
      const original = context?.originalItem;
      toast.success("Purchase goal updated", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              if (original) {
                await updateFuturePurchase({
                  id: original.id,
                  name: original.name,
                  target_amount: original.target_amount,
                  target_date: original.target_date,
                  notes: original.notes,
                  category: original.category,
                  priority: original.priority,
                  status: original.status,
                });
                qc.invalidateQueries({ queryKey: [QUERY_KEY] });
                toast.success("Update undone");
              }
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteFuturePurchase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: deleteFuturePurchase,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: [QUERY_KEY] });

      const previous = qc.getQueryData<FuturePurchase[]>([QUERY_KEY, {}]);

      // Store deleted item for undo
      const deletedItem = previous?.find((p) => p.id === id);

      // Optimistic delete
      qc.setQueryData<FuturePurchase[]>([QUERY_KEY, {}], (old) => {
        if (!old) return old;
        return old.filter((p) => p.id !== id);
      });

      return { previous, deletedItem };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        qc.setQueryData([QUERY_KEY, {}], context.previous);
      }
      toast.error(err.message || "Failed to delete purchase goal");
    },
    onSuccess: (_, __, context) => {
      const deleted = context?.deletedItem;
      toast.success("Purchase goal deleted", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              if (deleted) {
                await createFuturePurchase({
                  name: deleted.name,
                  target_amount: deleted.target_amount,
                  target_date: deleted.target_date,
                  notes: deleted.notes,
                  category: deleted.category,
                  priority: deleted.priority,
                });
                qc.invalidateQueries({ queryKey: [QUERY_KEY] });
                toast.success("Deletion undone");
              }
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useAllocateSavings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      amount,
      month,
    }: {
      id: string;
      amount: number;
      month?: string;
    }) => allocateSavings(id, amount, month),
    onSuccess: (updated, variables) => {
      const isCompleted = updated.status === "completed";
      const undoAction = {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              // Undo by allocating negative amount
              await allocateSavings(
                variables.id,
                -variables.amount,
                variables.month
              );
              qc.invalidateQueries({ queryKey: [QUERY_KEY] });
              toast.success("Allocation undone");
            } catch {
              toast.error("Failed to undo");
            }
          },
        },
      };
      if (isCompleted) {
        toast.success(
          `🎉 Congratulations! You've reached your "${updated.name}" goal!`,
          undoAction
        );
      } else {
        const percent = (
          (updated.current_saved / updated.target_amount) *
          100
        ).toFixed(0);
        toast.success(
          `Saved! ${percent}% of your "${updated.name}" goal reached`,
          undoAction
        );
      }
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to allocate savings");
    },
  });
}
