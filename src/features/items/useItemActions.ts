// src/features/items/useItemActions.ts
// Comprehensive hook for item actions: complete, postpone, cancel with undo support

import { supabaseBrowser } from "@/lib/supabase/client";
import type { ItemWithDetails } from "@/types/items";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, parseISO } from "date-fns";
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
  rrule: string,
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
  // Add 1 day to the current occurrence date, keeping the same time
  return addDays(date, 1).toISOString();
}

/**
 * Normalize a date to YYYY-MM-DD format in LOCAL timezone
 * This is critical for proper date comparison
 */
export function normalizeToLocalDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse a database timestamp to local date string
 * Handles both ISO and Postgres formats
 */
export function parseDbDateToLocalString(dbDate: string): string {
  // Parse the date and get local date string
  const date = new Date(dbDate);
  return normalizeToLocalDateString(date);
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
    queryKey: itemsKeys.allActions(),
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

/** Check if a specific occurrence is completed/cancelled/postponed (should not show on original date) */
export function isOccurrenceCompleted(
  itemId: string,
  occurrenceDate: Date,
  actions: ItemOccurrenceAction[],
): boolean {
  // Normalize to YYYY-MM-DD format in LOCAL timezone for comparison
  const targetDate = normalizeToLocalDateString(occurrenceDate);

  console.log("🔍 isOccurrenceCompleted called:", {
    itemId,
    occurrenceDate: occurrenceDate.toISOString(),
    targetDateLocal: targetDate,
    totalActions: actions.length,
    actionsForThisItem: actions.filter((a) => a.item_id === itemId),
  });

  const result = actions.some((action) => {
    if (action.item_id !== itemId) return false;
    // Include postponed in the check - postponed occurrences shouldn't show on original date
    if (
      action.action_type !== "completed" &&
      action.action_type !== "cancelled" &&
      action.action_type !== "postponed"
    )
      return false;

    // Parse the action's occurrence_date to local date string
    const actionDate = parseDbDateToLocalString(action.occurrence_date);
    const matches = actionDate === targetDate;

    console.log("  📋 Comparing action:", {
      actionId: action.id,
      actionOccurrenceDate: action.occurrence_date,
      actionDateLocal: actionDate,
      targetDateLocal: targetDate,
      actionType: action.action_type,
      matches,
    });

    return matches;
  });

  console.log("  ✅ Result:", result);

  return result;
}

/** Get postponed occurrences that should show on a specific date */
export function getPostponedOccurrencesForDate<T extends { id: string }>(
  items: T[],
  targetDate: Date,
  actions: ItemOccurrenceAction[],
): Array<{
  item: T;
  occurrenceDate: Date;
  originalDate: Date;
  isPostponed: true;
}> {
  // Normalize target date to local date string
  const targetDateStr = normalizeToLocalDateString(targetDate);
  const results: Array<{
    item: T;
    occurrenceDate: Date;
    originalDate: Date;
    isPostponed: true;
  }> = [];

  // Build a set of item+date combinations that have been completed or cancelled
  // so we can filter them out from postponed results
  const completedOrCancelledKeys = new Set<string>();
  for (const action of actions) {
    if (
      action.action_type === "completed" ||
      action.action_type === "cancelled"
    ) {
      const actionDateStr = parseDbDateToLocalString(action.occurrence_date);
      completedOrCancelledKeys.add(`${action.item_id}:${actionDateStr}`);
    }
  }

  for (const action of actions) {
    if (action.action_type !== "postponed" || !action.postponed_to) continue;

    // Parse the postponed_to date to local date string
    const postponedToDateStr = parseDbDateToLocalString(action.postponed_to);

    if (postponedToDateStr === targetDateStr) {
      // Check if this item has been completed/cancelled on the postponed-to date
      const key = `${action.item_id}:${postponedToDateStr}`;
      if (completedOrCancelledKeys.has(key)) {
        // This postponed item was subsequently completed/cancelled, skip it
        continue;
      }

      const item = items.find((i) => i.id === action.item_id);
      if (item) {
        results.push({
          item,
          occurrenceDate: new Date(action.postponed_to),
          originalDate: new Date(action.occurrence_date),
          isPostponed: true,
        });
      }
    }
  }

  return results;
}

/** Get completed occurrences for a specific date */
export function getCompletedOccurrencesForDate<T extends { id: string }>(
  items: T[],
  targetDate: Date,
  actions: ItemOccurrenceAction[],
): Array<{
  item: T;
  occurrenceDate: Date;
  completedAt: Date;
  isCompleted: true;
  actionId: string;
}> {
  // Normalize target date to local date string
  const targetDateStr = normalizeToLocalDateString(targetDate);
  const results: Array<{
    item: T;
    occurrenceDate: Date;
    completedAt: Date;
    isCompleted: true;
    actionId: string;
  }> = [];

  for (const action of actions) {
    if (action.action_type !== "completed") continue;

    // Parse the action's occurrence_date to local date string
    const actionDateStr = parseDbDateToLocalString(action.occurrence_date);

    if (actionDateStr === targetDateStr) {
      const item = items.find((i) => i.id === action.item_id);
      if (item) {
        results.push({
          item,
          occurrenceDate: new Date(action.occurrence_date),
          completedAt: new Date(action.created_at),
          isCompleted: true,
          actionId: action.id,
        });
      }
    }
  }

  return results;
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
      queryClient.invalidateQueries({ queryKey: itemsKeys.allActions() });
      queryClient.invalidateQueries({ queryKey: [...itemsKeys.all, "stats"] });
    },
  });
}

export interface UncompleteItemInput {
  itemId: string;
  occurrenceDate: string;
  isRecurring: boolean;
}

/** Uncomplete an item or occurrence (toggle back to pending) */
export function useUncompleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      occurrenceDate,
      isRecurring,
    }: UncompleteItemInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isRecurring) {
        // For recurring: delete the completion action for this occurrence
        const targetDateStr = normalizeToLocalDateString(
          new Date(occurrenceDate),
        );

        // Find and delete the completion action for this occurrence
        const { data: actions, error: fetchError } = await supabase
          .from("item_occurrence_actions")
          .select("id, occurrence_date")
          .eq("item_id", itemId)
          .eq("action_type", "completed");

        if (fetchError) throw fetchError;

        // Find the action that matches this occurrence date
        const actionToDelete = actions?.find((action) => {
          const actionDateStr = parseDbDateToLocalString(
            action.occurrence_date,
          );
          return actionDateStr === targetDateStr;
        });

        if (actionToDelete) {
          const { error: deleteError } = await supabase
            .from("item_occurrence_actions")
            .delete()
            .eq("id", actionToDelete.id);

          if (deleteError) throw deleteError;
        }

        return { type: "occurrence", itemId };
      } else {
        // For non-recurring: update item status back to pending
        const { error } = await supabase
          .from("items")
          .update({
            status: "pending",
            archived_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        if (error) throw error;

        // Also clear completed_at in reminder_details if it exists
        await supabase
          .from("reminder_details")
          .update({ completed_at: null })
          .eq("item_id", itemId);

        // Delete the completion action record
        await supabase
          .from("item_occurrence_actions")
          .delete()
          .eq("item_id", itemId)
          .eq("action_type", "completed");

        return { type: "item", itemId };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({ queryKey: itemsKeys.allActions() });
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

      // For non-recurring items, also update the due date and alert time
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

        // Fetch existing alerts to recalculate trigger_at for relative alerts
        const { data: alerts } = await supabase
          .from("item_alerts")
          .select("id, kind, offset_minutes")
          .eq("item_id", itemId)
          .eq("active", true);

        if (alerts && alerts.length > 0) {
          const postponedDate = new Date(postponedTo);

          for (const alert of alerts) {
            // For relative alerts, compute trigger_at = postponedTo - offset_minutes
            // For absolute alerts, just set trigger_at to postponedTo
            let newTriggerAt = postponedTo;
            if (alert.kind === "relative" && alert.offset_minutes) {
              newTriggerAt = new Date(
                postponedDate.getTime() - alert.offset_minutes * 60 * 1000,
              ).toISOString();
            }

            // Update the alert with new trigger time
            // Reset last_fired_at to null so the cron job will send the notification again
            await supabase
              .from("item_alerts")
              .update({
                trigger_at: newTriggerAt,
                last_fired_at: null,
              })
              .eq("id", alert.id);
          }
        }
      }

      return { action: data, postponedTo };
    },
    onSuccess: () => {
      // Invalidate both items and occurrence actions
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({ queryKey: itemsKeys.allActions() });
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
      queryClient.invalidateQueries({ queryKey: itemsKeys.allActions() });
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
        `,
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
  const uncompleteItem = useUncompleteItem();
  const postponeItem = usePostponeItem();
  const cancelItem = useCancelItem();
  const deleteItem = useDeleteItemWithUndo();
  const restoreItem = useRestoreItem();
  const undoAction = useUndoOccurrenceAction();

  const handleComplete = async (
    item: ItemWithDetails,
    occurrenceDate: string,
    reason?: string,
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
    reason?: string,
    customDate?: string,
  ) => {
    const isRecurring = !!item.recurrence_rule?.rrule;
    let postponedTo: string | undefined;

    // Calculate postponed_to based on type
    if (postponeType === "next_occurrence" && item.recurrence_rule?.rrule) {
      postponedTo = calculateNextOccurrence(
        occurrenceDate,
        item.recurrence_rule.rrule,
      );
    } else if (postponeType === "tomorrow") {
      postponedTo = calculateTomorrowSameTime(occurrenceDate);
    } else if (postponeType === "custom" && customDate) {
      postponedTo = customDate;
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
            : postponeType === "custom" && postponedTo
              ? new Date(postponedTo).toLocaleDateString()
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
    reason?: string,
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

  const handleUncomplete = async (
    item: ItemWithDetails,
    occurrenceDate: string,
  ) => {
    const isRecurring = !!item.recurrence_rule?.rrule;

    try {
      await uncompleteItem.mutateAsync({
        itemId: item.id,
        occurrenceDate,
        isRecurring,
      });

      toast.success(`"${item.title}" marked as pending`);
    } catch (error) {
      toast.error("Failed to uncomplete item");
      console.error(error);
    }
  };

  const handleToggleComplete = async (
    item: ItemWithDetails,
    occurrenceDate: string,
    isCurrentlyCompleted: boolean,
    reason?: string,
  ) => {
    if (isCurrentlyCompleted) {
      await handleUncomplete(item, occurrenceDate);
    } else {
      await handleComplete(item, occurrenceDate, reason);
    }
  };

  return {
    handleComplete,
    handleUncomplete,
    handleToggleComplete,
    handlePostpone,
    handleCancel,
    handleDelete,
    isLoading:
      completeItem.isPending ||
      uncompleteItem.isPending ||
      postponeItem.isPending ||
      cancelItem.isPending ||
      deleteItem.isPending,
  };
}

// ============================================
// AUTO-COMPLETE HELPER
// ============================================

/**
 * Check if all subtasks for an item/occurrence are completed
 * For recurring items: checks occurrence-specific completions
 * For one-time items: checks the done_at field on subtasks
 */
export function areAllSubtasksCompleted(
  subtasks: Array<{ id: string; done_at?: string | null }>,
  isRecurring: boolean,
  occurrenceDate: Date,
  subtaskCompletions?: Array<{
    subtask_id: string;
    occurrence_date: string;
  }>,
): boolean {
  if (!subtasks || subtasks.length === 0) return false;

  if (isRecurring && subtaskCompletions) {
    // For recurring items, check occurrence-specific completions
    const targetDateStr = normalizeToLocalDateString(occurrenceDate);
    const completedSubtaskIds = new Set(
      subtaskCompletions
        .filter(
          (c) =>
            normalizeToLocalDateString(new Date(c.occurrence_date)) ===
            targetDateStr,
        )
        .map((c) => c.subtask_id),
    );

    return subtasks.every((s) => completedSubtaskIds.has(s.id));
  } else {
    // For one-time items, check done_at field
    return subtasks.every((s) => s.done_at);
  }
}
