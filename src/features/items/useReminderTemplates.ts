// src/features/items/useReminderTemplates.ts
// React Query hooks for Reminder Templates CRUD operations

import type {
  CreateReminderTemplateInput,
  ItemWithDetails,
  LaunchReminderTemplateInput,
  ReminderTemplate,
  UpdateReminderTemplateInput,
} from "@/types/items";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { itemsKeys } from "./useItems";

// ============================================
// QUERY KEYS
// ============================================

export const reminderTemplatesKeys = {
  all: ["reminderTemplates"] as const,
  lists: () => [...reminderTemplatesKeys.all, "list"] as const,
  detail: (id: string) => [...reminderTemplatesKeys.all, "detail", id] as const,
};

// ============================================
// FETCH FUNCTIONS
// ============================================

async function fetchReminderTemplates(): Promise<ReminderTemplate[]> {
  const res = await fetch("/api/reminder-templates", {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch reminder templates");
  }
  return res.json();
}

// ============================================
// QUERY HOOKS
// ============================================

/** Fetch all reminder templates */
export function useReminderTemplates() {
  return useQuery({
    queryKey: reminderTemplatesKeys.lists(),
    queryFn: fetchReminderTemplates,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/** Create a new reminder template */
export function useCreateReminderTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReminderTemplateInput) => {
      const res = await fetch("/api/reminder-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create template");
      }
      return res.json() as Promise<ReminderTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderTemplatesKeys.all });
    },
  });
}

/** Update an existing reminder template */
export function useUpdateReminderTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateReminderTemplateInput & { id: string }) => {
      const res = await fetch("/api/reminder-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, ...input }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update template");
      }
      return res.json() as Promise<ReminderTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderTemplatesKeys.all });
    },
  });
}

/** Delete a reminder template */
export function useDeleteReminderTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/reminder-templates?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete template");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderTemplatesKeys.all });
    },
  });
}

/** Launch a reminder template (create an item from it) */
export function useLaunchReminderTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LaunchReminderTemplateInput) => {
      const res = await fetch("/api/reminder-templates/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to launch template");
      }
      return res.json() as Promise<ItemWithDetails>;
    },
    onSuccess: () => {
      // Invalidate both templates (for use_count) and items
      queryClient.invalidateQueries({ queryKey: reminderTemplatesKeys.all });
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}
