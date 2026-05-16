"use client";

import { safeFetch } from "@/lib/safeFetch";
import type {
  MealPlan,
  MealPlanInsert,
  MealPlanUpdate,
  MealPlanWithRecipe,
} from "@/types/recipe";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mealPlanKeys } from "./queryKeys";

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchMealPlansByDateRange(
  startDate: string,
  endDate: string,
): Promise<MealPlanWithRecipe[]> {
  // Extend start by 14 days to capture meals with leftover dates that overlap this range
  const extStart = new Date(startDate);
  extStart.setDate(extStart.getDate() - 14);
  const extStartStr = extStart.toISOString().split("T")[0];

  const res = await fetch(`/api/meal-plans?start=${extStartStr}&end=${endDate}`);
  if (!res.ok) throw new Error(await res.text());
  const all: MealPlanWithRecipe[] = await res.json();

  // Keep only plans that are "active" during [startDate, endDate]
  return all.filter((mp) => {
    const lastDay = mp.eats_through_date ?? mp.planned_date;
    return lastDay >= startDate;
  });
}

async function fetchMealPlansByDate(date: string): Promise<MealPlanWithRecipe[]> {
  const res = await fetch(`/api/meal-plans?date=${date}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function createMealPlan(input: MealPlanInsert): Promise<MealPlan> {
  const res = await safeFetch("/api/meal-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error || "Failed to create meal plan");
  }
  return res.json();
}

async function updateMealPlan(id: string, input: MealPlanUpdate): Promise<MealPlan> {
  const res = await safeFetch(`/api/meal-plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error || "Failed to update meal plan");
  }
  return res.json();
}

async function deleteMealPlan(id: string): Promise<void> {
  const res = await safeFetch(`/api/meal-plans/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error || "Failed to delete meal plan");
  }
}

// =============================================================================
// HOOKS
// =============================================================================

export function useHousehold(currentUserId?: string) {
  return useQuery({
    queryKey: ["household", currentUserId],
    queryFn: async () => {
      const res = await fetch("/api/household");
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.link) return null;
      const { link } = data as {
        link: {
          id: string;
          owner_user_id: string;
          partner_user_id: string | null;
        };
      };
      const partnerId =
        link.owner_user_id === currentUserId
          ? link.partner_user_id
          : link.owner_user_id;
      return { id: link.id, partner_id: partnerId ?? null };
    },
    enabled: !!currentUserId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMealPlansForWeek(startDate: string) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const end = endDate.toISOString().split("T")[0];

  return useQuery({
    queryKey: mealPlanKeys.byWeek(startDate),
    queryFn: () => fetchMealPlansByDateRange(startDate, end),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMealPlansForDate(date: string) {
  return useQuery({
    queryKey: mealPlanKeys.byDate(date),
    queryFn: () => fetchMealPlansByDate(date),
    staleTime: 2 * 60 * 1000,
  });
}

// Mutation hooks — callers handle toast feedback so they can implement proper undo
export function useCreateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMealPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.all });
    },
    onError: (error: Error) => {
      // Errors surface via mutateAsync rejection — callers show the toast
      void error;
    },
  });
}

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: MealPlanUpdate & { id: string }) =>
      updateMealPlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.all });
    },
  });
}

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mealPlanKeys.all });
    },
  });
}
