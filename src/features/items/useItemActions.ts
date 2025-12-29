// src/features/items/useItemActions.ts
// Comprehensive hook for item actions: complete, postpone, cancel with undo support

import { supabaseBrowser } from "@/lib/supabase/client";
import type { ItemWithDetails } from "@/types/items";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, parseISO, setHours, setMinutes } from "date-fns";
import { toast } from "sonner";
import { itemsKeys } from "./useItems";

// ============================================
// TYPES
// ============================================

export type ActionType = "completed" | "postponed" | "cancelled" | "skipped";
export type PostponeType =
  | "next_occurrence"
  | "tomorrow"
  | "custom"
  | "ai_slot";

export interface ItemOccurrenceAction {
  id: string;
  item_id: string;
  occurrence_date: string;
  action_type: ActionType;
  postponed_to?: string | null;
  postpone_type?: PostponeType | null;
  reason?: string | null;
  created_at: string;
  created_by?: string | null;
}

export interface CompleteItemInput {
  itemId: string;
  occurrenceDate: string;
  isRecurring: boolean;
  reason?: string;
}

export interface PostponeItemInput {
  itemId: string;
  occurrenceDate: string;
  postponeType: PostponeType;
  postponedTo?: string;
  reason?: string;
  isRecurring: boolean;
}

export interface CancelItemInput {
  itemId: string;
  occurrenceDate?: string; // If recurring, the specific occurrence
  isRecurring: boolean;
  reason?: string;
}

export interface ItemStats {
  item_id: string;
  completed_count: number;
  postponed_count: number;
  cancelled_count: number;
  skipped_count: number;
  total_actions: number;
  last_completed_at?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate the next occurrence date based on recurrence rule
 */
export function calculateNextOccurrence(
  currentDate: string,
  rrule: string
): string {
  const date = parseISO(currentDate);

  if (rrule.includes("FREQ=DAILY")) {
    return addDays(date, 1).toISOString();
  }
  if (rrule.includes("FREQ=WEEKLY")) {
    const interval = rrule.match(/INTERVAL=(\d+)/)?.[1];
    const weeks = interval ? parseInt(interval) : 1;
    return addWeeks(date, weeks).toISOString();
  }
  if (rrule.includes("FREQ=MONTHLY")) {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + 1);
    return newDate.toISOString();
  }
  if (rrule.includes("FREQ=YEARLY")) {
    const newDate = new Date(date);
    newDate.setFullYear(newDate.getFullYear() + 1);
    return newDate.toISOString();
  }

  // Default: add 1 day
  return addDays(date, 1).toISOString();
}

/**
 * Calculate tomorrow at the same time
 */
export function calculateTomorrowSameTime(currentDate: string): string {
  const date = parseISO(currentDate);
  const tomorrow = addDays(new Date(), 1);
  return setMinutes(
    setHours(tomorrow, date.getHours()),
    date.getMinutes()
  ).toISOString();
}

// ============================================
// QUERY HOOKS
// ============================================

/** Fetch all occurrence actions for an item */
export function useItemOccurrenceActions(itemId: string | undefined) {
  return useQuery({
    queryKey: [...itemsKeys.all, "actions", itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const supabase = supabaseBrowser();
      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .select("*")
        .eq("item_id", itemId)
        .order("occurrence_date", { ascending: false });

      if (error) throw error;
      return data as ItemOccurrenceAction[];
    },
    enabled: !!itemId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Fetch all occurrence actions for a date range (for filtering completed occurrences) */
export function useAllOccurrenceActions() {
  return useQuery({
    queryKey: [...itemsKeys.all, "all-actions"],
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      // Get actions from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .select("*")
        .gte("occurrence_date", thirtyDaysAgo.toISOString())
        .order("occurrence_date", { ascending: false });

      if (error) throw error;

      console.log("📊 All occurrence actions loaded:", data);

      return data as ItemOccurrenceAction[];
    },
    staleTime: 0, // Always refetch to ensure fresh data
    refetchOnMount: true,
  });
}

/** Check if a specific occurrence is completed/cancelled */
export function isOccurrenceCompleted(
  itemId: string,
  occurrenceDate: Date,
  actions: ItemOccurrenceAction[]
): boolean {
  // Normalize to YYYY-MM-DD format for comparison
  const targetDate = occurrenceDate.toISOString().split("T")[0];

  console.log("🔍 isOccurrenceCompleted called:", {
    itemId,
    occurrenceDate: occurrenceDate.toISOString(),
    targetDate,
    totalActions: actions.length,
    actionsForThisItem: actions.filter((a) => a.item_id === itemId),
  });

  const result = actions.some((action) => {
    if (action.item_id !== itemId) return false;
    if (
      action.action_type !== "completed" &&
      action.action_type !== "cancelled"
    )
      return false;

    // Extract date part from occurrence_date (handles both ISO and postgres timestamp formats)
    let actionDate: string;
    if (action.occurrence_date.includes("T")) {
      // ISO format: 2025-12-15T10:00:00.000Z
      actionDate = action.occurrence_date.split("T")[0];
    } else {
      // Postgres timestamp format: 2025-12-15 10:00:00
      actionDate = action.occurrence_date.split(" ")[0];
    }

    const matches = actionDate === targetDate;

    console.log("  📋 Comparing action:", {
      actionId: action.id,
      actionOccurrenceDate: action.occurrence_date,
      actionDate,
      targetDate,
      actionType: action.action_type,
      matches,
    });

    return matches;
  });

  console.log("  ✅ Result:", result);

  return result;
}

/** Fetch completion stats for user's items */
export function useItemStats() {
  return useQuery({
    queryKey: [...itemsKeys.all, "stats"],
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("item_completion_stats")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as ItemStats[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Get aggregated stats for all items */
export function useAggregatedStats() {
  const { data: stats = [] } = useItemStats();

  return {
    totalCompleted: stats.reduce((sum, s) => sum + (s.completed_count || 0), 0),
    totalPostponed: stats.reduce((sum, s) => sum + (s.postponed_count || 0), 0),
    totalCancelled: stats.reduce((sum, s) => sum + (s.cancelled_count || 0), 0),
    totalActions: stats.reduce((sum, s) => sum + (s.total_actions || 0), 0),
  };
}

// ============================================
// MUTATION HOOKS
// ============================================

/** Complete an item or occurrence */
export function useCompleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      occurrenceDate,
      isRecurring,
      reason,
    }: CompleteItemInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isRecurring) {
        // For recurring: record completion of this occurrence
        const { data, error } = await supabase
          .from("item_occurrence_actions")
          .insert({
            item_id: itemId,
            occurrence_date: occurrenceDate,
            action_type: "completed",
            reason,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return { action: data, type: "occurrence" };
      } else {
        // For non-recurring: determine if should be archived (if before this week)
        const occurrenceDateObj = parseISO(occurrenceDate);
        const now = new Date();
        const weekStart = new Date(now);
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysFromMonday = (dayOfWeek + 6) % 7; // Convert to Monday-based (0 = Monday)
        weekStart.setDate(now.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);

        // Archive if the item's date is before the start of this week
        const shouldArchive = occurrenceDateObj < weekStart;
        const status = "completed";

        const updatePayload: any = {
          status,
          updated_at: new Date().toISOString(),
        };

        if (shouldArchive) {
          updatePayload.archived_at = new Date().toISOString();
        }

        // For non-recurring: update item status + record action
        const [itemResult, actionResult] = await Promise.all([
          supabase.from("items").update(updatePayload).eq("id", itemId),
          supabase.from("item_occurrence_actions").insert({
            item_id: itemId,
            occurrence_date: occurrenceDate,
            action_type: "completed",
            reason,
            created_by: user.id,
          }),
        ]);

        if (itemResult.error) throw itemResult.error;

        // Also update reminder_details if it exists
        await supabase
          .from("reminder_details")
          .update({ completed_at: new Date().toISOString() })
          .eq("item_id", itemId);

        return { type: "item", itemId, archived: shouldArchive };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...itemsKeys.all, "all-actions"],
      });
      queryClient.invalidateQueries({ queryKey: [...itemsKeys.all, "stats"] });
      queryClient.invalidateQueries({
        queryKey: [...itemsKeys.all, "all-actions"],
      });
      queryClient.invalidateQueries({ queryKey: [...itemsKeys.all, "stats"] });
    },
  });
}

/** Postpone an item or occurrence */
export function usePostponeItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      occurrenceDate,
      postponeType,
      postponedTo,
      reason,
      isRecurring,
    }: PostponeItemInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Record the postponement action
      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .insert({
          item_id: itemId,
          occurrence_date: occurrenceDate,
          action_type: "postponed",
          postponed_to: postponedTo,
          postpone_type: postponeType,
          reason,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // For non-recurring items, also update the due date
      if (!isRecurring && postponedTo) {
        // Try updating reminder_details
        await supabase
          .from("reminder_details")
          .update({ due_at: postponedTo })
          .eq("item_id", itemId);

        // Try updating event_details
        await supabase
          .from("event_details")
          .update({ start_at: postponedTo })
          .eq("item_id", itemId);
      }

      return { action: data, postponedTo };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Cancel an item or occurrence */
export function useCancelItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      occurrenceDate,
      isRecurring,
      reason,
    }: CancelItemInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isRecurring && occurrenceDate) {
        // For recurring: record cancellation of this occurrence only
        const { data, error } = await supabase
          .from("item_occurrence_actions")
          .insert({
            item_id: itemId,
            occurrence_date: occurrenceDate,
            action_type: "cancelled",
            reason,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        return { action: data, type: "occurrence" };
      } else {
        // For non-recurring: update item status to cancelled
        const { error } = await supabase
          .from("items")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        if (error) throw error;
        return { type: "item", itemId };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...itemsKeys.all, "all-actions"],
      });
      queryClient.invalidateQueries({ queryKey: [...itemsKeys.all, "stats"] });
    },
  });
}

/** Delete (hard delete) an item - with undo support */
export function useDeleteItemWithUndo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = supabaseBrowser();

      // First, get the item data for undo
      const { data: item, error: fetchError } = await supabase
        .from("items")
        .select(
          `
          *,
          reminder_details (*),
          event_details (*),
          item_recurrence_rules (*)
        `
        )
        .eq("id", itemId)
        .single();

      if (fetchError) throw fetchError;

      // Soft delete by archiving
      const { error } = await supabase
        .from("items")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", itemId);

      if (error) throw error;

      return { deletedItem: item };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Undo a deletion (restore archived item) */
export function useRestoreItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const supabase = supabaseBrowser();

      const { error } = await supabase
        .from("items")
        .update({ archived_at: null })
        .eq("id", itemId);

      if (error) throw error;
      return itemId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Undo an occurrence action */
export function useUndoOccurrenceAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const supabase = supabaseBrowser();

      const { error } = await supabase
        .from("item_occurrence_actions")
        .delete()
        .eq("id", actionId);

      if (error) throw error;
      return actionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({
        queryKey: [...itemsKeys.all, "all-actions"],
      });
      queryClient.invalidateQueries({ queryKey: [...itemsKeys.all, "stats"] });
    },
  });
}

// ============================================
// CONVENIENCE HOOK WITH TOAST SUPPORT
// ============================================

export function useItemActionsWithToast() {
  const completeItem = useCompleteItem();
  const postponeItem = usePostponeItem();
  const cancelItem = useCancelItem();
  const deleteItem = useDeleteItemWithUndo();
  const restoreItem = useRestoreItem();
  const undoAction = useUndoOccurrenceAction();

  const handleComplete = async (
    item: ItemWithDetails,
    occurrenceDate: string,
    reason?: string
  ) => {
    const isRecurring = !!item.recurrence_rule?.rrule;

    try {
      const result = await completeItem.mutateAsync({
        itemId: item.id,
        occurrenceDate,
        isRecurring,
        reason,
      });

      const wasArchived = result.type === "item" && (result as any).archived;
      const message = wasArchived
        ? `"${item.title}" completed and archived`
        : `"${item.title}" completed!`;

      toast.success(message, {
        action: {
          label: "Undo",
          onClick: async () => {
            if (result.type === "occurrence" && result.action) {
              await undoAction.mutateAsync(result.action.id);
              toast.success("Completion undone");
            } else if (result.type === "item") {
              // For non-recurring items, restore from completed/archived
              await restoreItem.mutateAsync(item.id);
              toast.success("Item restored");
            }
          },
        },
      });
    } catch (error) {
      toast.error("Failed to complete item");
      console.error(error);
    }
  };

  const handlePostpone = async (
    item: ItemWithDetails,
    occurrenceDate: string,
    postponeType: PostponeType,
    reason?: string
  ) => {
    const isRecurring = !!item.recurrence_rule?.rrule;
    let postponedTo: string | undefined;

    // Calculate postponed_to based on type
    if (postponeType === "next_occurrence" && item.recurrence_rule?.rrule) {
      postponedTo = calculateNextOccurrence(
        occurrenceDate,
        item.recurrence_rule.rrule
      );
    } else if (postponeType === "tomorrow") {
      postponedTo = calculateTomorrowSameTime(occurrenceDate);
    }

    try {
      const result = await postponeItem.mutateAsync({
        itemId: item.id,
        occurrenceDate,
        postponeType,
        postponedTo,
        reason,
        isRecurring,
      });

      const label =
        postponeType === "next_occurrence"
          ? "next occurrence"
          : postponeType === "tomorrow"
            ? "tomorrow"
            : "later";

      toast.success(`"${item.title}" postponed to ${label}`, {
        action: {
          label: "Undo",
          onClick: async () => {
            if (result.action) {
              await undoAction.mutateAsync(result.action.id);
              toast.success("Postponement undone");
            }
          },
        },
      });
    } catch (error) {
      toast.error("Failed to postpone item");
      console.error(error);
    }
  };

  const handleCancel = async (
    item: ItemWithDetails,
    occurrenceDate?: string,
    reason?: string
  ) => {
    const isRecurring = !!item.recurrence_rule?.rrule;

    try {
      const result = await cancelItem.mutateAsync({
        itemId: item.id,
        occurrenceDate,
        isRecurring,
        reason,
      });

      const message = isRecurring
        ? `This occurrence of "${item.title}" cancelled`
        : `"${item.title}" cancelled`;

      toast.success(message, {
        action: {
          label: "Undo",
          onClick: async () => {
            if (result.type === "occurrence" && result.action) {
              await undoAction.mutateAsync(result.action.id);
              toast.success("Cancellation undone");
            }
          },
        },
      });
    } catch (error) {
      toast.error("Failed to cancel item");
      console.error(error);
    }
  };

  const handleDelete = async (item: ItemWithDetails) => {
    try {
      await deleteItem.mutateAsync(item.id);

      toast.success(`"${item.title}" removed`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreItem.mutateAsync(item.id);
            toast.success("Item restored");
          },
        },
      });
    } catch (error) {
      toast.error("Failed to delete item");
      console.error(error);
    }
  };

  return {
    handleComplete,
    handlePostpone,
    handleCancel,
    handleDelete,
    isLoading:
      completeItem.isPending ||
      postponeItem.isPending ||
      cancelItem.isPending ||
      deleteItem.isPending,
  };
}
