"use client";

import { safeFetch } from "@/lib/safeFetch";
import { ToastIcons } from "@/lib/toastIcons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ChecklistItem, DayPlan, DayPlanIntent, DayPlansResponse } from "./types";

export const dayPlanKeys = {
  all: ["day-plan"] as const,
  byDate: (date: string) => [...dayPlanKeys.all, date] as const,
};

async function fetchDayPlans(date: string): Promise<DayPlansResponse> {
  const response = await safeFetch(`/api/day-plans?date=${date}`);
  if (!response.ok) throw new Error(`Failed to load day plan: ${response.status}`);
  return response.json();
}

export function useDayPlan(date: string) {
  return useQuery({
    queryKey: dayPlanKeys.byDate(date),
    queryFn: () => fetchDayPlans(date),
    staleTime: 1000 * 60,
  });
}

interface UpsertDayPlanInput {
  plan_date: string;
  title?: string | null;
  intent?: DayPlanIntent | null;
  notes?: string | null;
  is_public?: boolean;
  checklist?: ChecklistItem[];
}

export function useUpsertDayPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertDayPlanInput) => {
      const response = await safeFetch("/api/day-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Save failed: ${response.status}`);
      }
      return response.json() as Promise<DayPlan>;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: dayPlanKeys.byDate(plan.plan_date) });
    },
  });
}

export function useDeleteDayPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; planDate: string }) => {
      const response = await safeFetch(`/api/day-plans/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Delete failed: ${response.status}`);
      }
    },
    onSuccess: (_data, { planDate }) => {
      queryClient.invalidateQueries({ queryKey: dayPlanKeys.byDate(planDate) });
    },
  });
}

interface ChecklistMutationContext {
  planId: string;
  planDate: string;
  checklist: ChecklistItem[];
}

function usePatchChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, checklist }: ChecklistMutationContext) => {
      const response = await safeFetch(`/api/day-plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Update failed: ${response.status}`);
      }
      return response.json() as Promise<DayPlan>;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: dayPlanKeys.byDate(plan.plan_date) });
    },
  });
}

/** Live done/undone toggle for a saved plan's checklist — bypasses the draft+Save flow. */
export function useChecklistActions(plan: DayPlan | null, planDate: string) {
  const patchChecklist = usePatchChecklist();

  const toggleChecklistItem = async (itemId: string) => {
    if (!plan) return;
    const target = plan.checklist.find((c) => c.id === itemId);
    if (!target) return;
    const wasDone = !!target.done_at;
    const updated = plan.checklist.map((c) =>
      c.id === itemId ? { ...c, done_at: wasDone ? null : new Date().toISOString() } : c,
    );
    await patchChecklist.mutateAsync({ planId: plan.id, planDate, checklist: updated });
    toast.success(wasDone ? `"${target.label}" reopened` : `"${target.label}" checked off`, {
      icon: wasDone ? ToastIcons.update : ToastIcons.success,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          patchChecklist.mutate({ planId: plan.id, planDate, checklist: plan.checklist }),
      },
    });
  };

  return { toggleChecklistItem };
}
