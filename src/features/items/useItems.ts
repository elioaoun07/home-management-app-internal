// src/features/items/useItems.ts
// React Query hooks for Items CRUD operations

import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  CreateEventInput,
  CreateReminderInput,
  CreateTaskInput,
  Item,
  ItemCategory,
  ItemsFilter,
  ItemsSort,
  ItemWithDetails,
  Subtask,
  UpdateEventInput,
  UpdateItemInput,
  UpdateReminderInput,
} from "@/types/items";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================
// QUERY KEYS
// ============================================

export const itemsKeys = {
  all: ["items"] as const,
  lists: () => [...itemsKeys.all, "list"] as const,
  list: (filters: ItemsFilter) => [...itemsKeys.lists(), filters] as const,
  details: () => [...itemsKeys.all, "detail"] as const,
  detail: (id: string) => [...itemsKeys.details(), id] as const,
  reminders: () => [...itemsKeys.all, "reminders"] as const,
  events: () => [...itemsKeys.all, "events"] as const,
  tasks: () => [...itemsKeys.all, "tasks"] as const,
  categories: () => [...itemsKeys.all, "categories"] as const,
  upcoming: () => [...itemsKeys.all, "upcoming"] as const,
  overdue: () => [...itemsKeys.all, "overdue"] as const,
  allActions: () => [...itemsKeys.all, "all-actions"] as const,
  subtaskCompletions: (itemId?: string) =>
    [...itemsKeys.all, "subtask-completions", itemId] as const,
};

// ============================================
// FETCH FUNCTIONS
// ============================================

async function fetchItems(
  filters?: ItemsFilter,
  sort?: ItemsSort,
): Promise<ItemWithDetails[]> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch partner ID to include their public items
  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  const partnerId = link
    ? link.owner_user_id === user.id
      ? link.partner_user_id
      : link.owner_user_id
    : null;

  let query = supabase
    .from("items")
    .select(
      `
      *,
      reminder_details (*),
      event_details (*),
      item_subtasks (*),
      item_alerts (*),
      item_recurrence_rules (*)
    `,
    )
    .is("archived_at", null);

  if (partnerId) {
    // Fetch my items OR partner's public items
    // Using separate filter: my items, or partner items that are public
    query = query.or(`user_id.eq.${user.id},user_id.eq.${partnerId}`);
  } else {
    query = query.eq("user_id", user.id);
  }

  // Fetch the data first, then filter partner's private items on the client
  // This is needed because Supabase doesn't support complex AND/OR nesting well

  // Apply filters
  if (filters?.type) {
    if (Array.isArray(filters.type)) {
      query = query.in("type", filters.type);
    } else {
      query = query.eq("type", filters.type);
    }
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  if (filters?.priority) {
    if (Array.isArray(filters.priority)) {
      query = query.in("priority", filters.priority);
    } else {
      query = query.eq("priority", filters.priority);
    }
  }

  if (filters?.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
    );
  }

  if (filters?.archived !== undefined) {
    if (filters.archived) {
      query = query.not("archived_at", "is", null);
    }
  }

  // Apply sorting
  if (sort) {
    query = query.order(sort.field, { ascending: sort.direction === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter out partner's private items on the client side
  // (Supabase doesn't support complex AND/OR nesting in .or())
  const filteredData = (data || []).filter((item: any) => {
    // Always include my own items
    if (item.user_id === user.id) return true;
    // Only include partner's items if they are public
    if (partnerId && item.user_id === partnerId) {
      return item.is_public === true;
    }
    return false;
  });

  // Transform the data to match our types
  return filteredData.map((item: any) => ({
    ...item,
    categories: item.categories || [],
    subtasks: item.item_subtasks || [],
    alerts: item.item_alerts || [],
    recurrence_rule: item.item_recurrence_rules?.[0] || null,
  }));
}

async function fetchItemById(id: string): Promise<ItemWithDetails | null> {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from("items")
    .select(
      `
      *,
      reminder_details (*),
      event_details (*),
      item_subtasks (*),
      item_alerts (*),
      item_recurrence_rules (*),
      item_attachments (*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return {
    ...data,
    categories: data.categories || [],
    subtasks: data.item_subtasks || [],
    alerts: data.item_alerts || [],
    recurrence_rule: data.item_recurrence_rules?.[0] || null,
    attachments: data.item_attachments || [],
  };
}

async function fetchItemCategories(): Promise<ItemCategory[]> {
  // Hardcoded categories - no database fetch needed
  // These are the default categories for all users
  return [
    {
      id: "personal",
      name: "Personal",
      color_hex: "#8B5CF6",
      position: 1,
      user_id: "",
      created_at: "",
      updated_at: "",
    },
    {
      id: "home",
      name: "Home",
      color_hex: "#1E90FF",
      position: 2,
      user_id: "",
      created_at: "",
      updated_at: "",
    },
    {
      id: "family",
      name: "Family",
      color_hex: "#FFA500",
      position: 3,
      user_id: "",
      created_at: "",
      updated_at: "",
    },
    {
      id: "community",
      name: "Community",
      color_hex: "#22C55E",
      position: 4,
      user_id: "",
      created_at: "",
      updated_at: "",
    },
    {
      id: "friends",
      name: "Friends",
      color_hex: "#EC4899",
      position: 5,
      user_id: "",
      created_at: "",
      updated_at: "",
    },
    {
      id: "work",
      name: "Work",
      color_hex: "#FF3B30",
      position: 6,
      user_id: "",
      created_at: "",
      updated_at: "",
    },
  ];
}

// ============================================
// QUERY HOOKS
// ============================================

/** Fetch all items with optional filters */
export function useItems(filters?: ItemsFilter, sort?: ItemsSort) {
  return useQuery({
    queryKey: itemsKeys.list(filters || {}),
    queryFn: () => fetchItems(filters, sort),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/** Fetch reminders only */
export function useReminders() {
  return useQuery({
    queryKey: itemsKeys.reminders(),
    queryFn: () => fetchItems({ type: "reminder" }),
    staleTime: 1000 * 60 * 2,
  });
}

/** Fetch events only */
export function useEvents() {
  return useQuery({
    queryKey: itemsKeys.events(),
    queryFn: () => fetchItems({ type: "event" }),
    staleTime: 1000 * 60 * 2,
  });
}

/** Fetch tasks only */
export function useTasks() {
  return useQuery({
    queryKey: itemsKeys.tasks(),
    queryFn: () => fetchItems({ type: "task" }),
    staleTime: 1000 * 60 * 2,
  });
}

/** Fetch a single item by ID */
export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: itemsKeys.detail(id || ""),
    queryFn: () => fetchItemById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

/** Fetch item categories */
export function useItemCategories() {
  return useQuery({
    queryKey: itemsKeys.categories(),
    queryFn: fetchItemCategories,
    staleTime: 1000 * 60 * 10, // 10 minutes - categories rarely change
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/** Create a new reminder */
export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReminderInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the base item
      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          user_id: user.id,
          type: "reminder",
          title: input.title,
          description: input.description,
          priority: input.priority || "normal",
          status: input.status || "pending",
          metadata_json: input.metadata_json,
          is_public: input.is_public || false,
          responsible_user_id: input.responsible_user_id || user.id,
          categories: input.category_ids || [],
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Create reminder details
      const { error: detailsError } = await supabase
        .from("reminder_details")
        .insert({
          item_id: item.id,
          due_at: input.due_at,
          estimate_minutes: input.estimate_minutes,
          has_checklist: input.has_checklist || false,
        });

      if (detailsError) throw detailsError;

      // Create subtasks if provided
      if (input.subtasks?.length) {
        const subtasks = input.subtasks.map((s, i) => ({
          parent_item_id: item.id,
          title: s.title,
          order_index: s.order_index ?? i,
        }));
        const { error: subtasksError } = await supabase
          .from("item_subtasks")
          .insert(subtasks);
        if (subtasksError) throw subtasksError;
      }

      // Create alerts if provided
      if (input.alerts?.length) {
        const alerts = input.alerts.map((a) => {
          // For relative alerts, compute the actual trigger_at based on due_at
          let computedTriggerAt = a.trigger_at;
          if (a.kind === "relative" && a.offset_minutes && input.due_at) {
            const baseTime = new Date(input.due_at);
            computedTriggerAt = new Date(
              baseTime.getTime() - a.offset_minutes * 60 * 1000,
            ).toISOString();
          }
          return {
            item_id: item.id,
            kind: a.kind,
            trigger_at: computedTriggerAt,
            offset_minutes: a.offset_minutes,
            relative_to: a.relative_to,
            repeat_every_minutes: a.repeat_every_minutes,
            max_repeats: a.max_repeats,
            channel: a.channel || "push",
          };
        });
        const { error: alertsError } = await supabase
          .from("item_alerts")
          .insert(alerts);
        if (alertsError) throw alertsError;
      } else if (input.due_at) {
        // Auto-create a push alert at the due time if no alerts provided
        console.log(
          "[useCreateReminder] Creating auto-alert for due_at:",
          input.due_at,
        );
        const { data: alertData, error: alertsError } = await supabase
          .from("item_alerts")
          .insert({
            item_id: item.id,
            kind: "absolute",
            trigger_at: input.due_at,
            channel: "push",
            active: true,
          })
          .select()
          .single();

        if (alertsError) {
          console.error("Failed to create auto-alert:", alertsError);
          // Still throw so user knows there was an issue
          throw new Error(
            `Reminder created but alert failed: ${alertsError.message}`,
          );
        } else {
          console.log("[useCreateReminder] Auto-alert created:", alertData);
        }
      }

      // Create recurrence rule if provided
      if (input.recurrence_rule?.rrule) {
        const { error: recurrenceError } = await supabase
          .from("item_recurrence_rules")
          .insert({
            item_id: item.id,
            rrule: input.recurrence_rule.rrule,
            start_anchor: input.due_at || new Date().toISOString(),
            end_until: input.recurrence_rule.end_until,
            count: input.recurrence_rule.count,
          });
        if (recurrenceError) {
          console.error("Failed to create recurrence rule:", recurrenceError);
        }
      }

      return item as Item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Create a new event */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the base item
      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          user_id: user.id,
          type: "event",
          title: input.title,
          description: input.description,
          priority: input.priority || "normal",
          status: input.status,
          metadata_json: input.metadata_json,
          is_public: input.is_public || false,
          responsible_user_id: input.responsible_user_id || user.id,
          categories: input.category_ids || [],
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Create event details
      const { error: detailsError } = await supabase
        .from("event_details")
        .insert({
          item_id: item.id,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day || false,
          location_text: input.location_text,
        });

      if (detailsError) throw detailsError;

      // Create recurrence rule if provided
      if (input.recurrence_rule) {
        const { error: recurrenceError } = await supabase
          .from("item_recurrence_rules")
          .insert({
            item_id: item.id,
            rrule: input.recurrence_rule.rrule,
            start_anchor: input.recurrence_rule.start_anchor,
            end_until: input.recurrence_rule.end_until,
            count: input.recurrence_rule.count,
          });
        if (recurrenceError) throw recurrenceError;
      }

      // Create alerts if provided
      if (input.alerts?.length) {
        const alerts = input.alerts.map((a) => {
          // For relative alerts, compute the actual trigger_at based on start_at or end_at
          let computedTriggerAt = a.trigger_at;
          if (a.kind === "relative" && a.offset_minutes) {
            const baseTimeStr =
              a.relative_to === "end" ? input.end_at : input.start_at;
            if (baseTimeStr) {
              const baseTime = new Date(baseTimeStr);
              computedTriggerAt = new Date(
                baseTime.getTime() - a.offset_minutes * 60 * 1000,
              ).toISOString();
            }
          }
          return {
            item_id: item.id,
            kind: a.kind,
            trigger_at: computedTriggerAt,
            offset_minutes: a.offset_minutes,
            relative_to: a.relative_to,
            repeat_every_minutes: a.repeat_every_minutes,
            max_repeats: a.max_repeats,
            channel: a.channel || "push",
          };
        });
        const { error: alertsError } = await supabase
          .from("item_alerts")
          .insert(alerts);
        if (alertsError) throw alertsError;
      }

      return item as Item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Create a new task */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the base item
      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          user_id: user.id,
          type: "task",
          title: input.title,
          description: input.description,
          priority: input.priority || "normal",
          status: "pending",
          metadata_json: input.metadata_json,
          is_public: input.is_public || false,
          responsible_user_id: input.responsible_user_id || user.id,
          categories: input.category_ids || [],
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Create reminder details (for due date and duration)
      if (input.due_at || input.estimate_minutes) {
        const { error: detailsError } = await supabase
          .from("reminder_details")
          .insert({
            item_id: item.id,
            due_at: input.due_at,
            estimate_minutes: input.estimate_minutes,
            has_checklist: false,
          });

        if (detailsError) throw detailsError;
      }

      // Create recurrence rule if provided
      if (input.recurrence_rule) {
        const { error: recurrenceError } = await supabase
          .from("item_recurrence_rules")
          .insert({
            item_id: item.id,
            rrule: input.recurrence_rule.rrule,
            start_anchor: input.recurrence_rule.start_anchor,
            end_until: input.recurrence_rule.end_until,
            count: input.recurrence_rule.count,
          });

        if (recurrenceError) throw recurrenceError;
      }

      // Auto-create a push alert at the due time for tasks with a due date
      if (input.due_at) {
        const { error: alertsError } = await supabase
          .from("item_alerts")
          .insert({
            item_id: item.id,
            kind: "absolute",
            trigger_at: input.due_at,
            channel: "push",
            active: true,
          });

        if (alertsError) {
          console.error("Failed to create auto-alert for task:", alertsError);
        }
      }

      return item as Item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Update an item */
export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateItemInput & { id: string }) => {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase
        .from("items")
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Item;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({ queryKey: itemsKeys.detail(data.id) });
    },
  });
}

/** Update reminder details */
export function useUpdateReminderDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      ...input
    }: UpdateReminderInput & { itemId: string }) => {
      const supabase = supabaseBrowser();

      // Update base item
      if (
        Object.keys(input).some((k) =>
          [
            "title",
            "description",
            "priority",
            "status",
            "is_public",
            "archived_at",
          ].includes(k),
        )
      ) {
        const itemUpdate: any = {};
        if (input.title !== undefined) itemUpdate.title = input.title;
        if (input.description !== undefined)
          itemUpdate.description = input.description;
        if (input.priority !== undefined) itemUpdate.priority = input.priority;
        if (input.status !== undefined) itemUpdate.status = input.status;
        if (input.is_public !== undefined)
          itemUpdate.is_public = input.is_public;
        if (input.archived_at !== undefined)
          itemUpdate.archived_at = input.archived_at;

        if (Object.keys(itemUpdate).length > 0) {
          itemUpdate.updated_at = new Date().toISOString();
          const { error: itemError } = await supabase
            .from("items")
            .update(itemUpdate)
            .eq("id", itemId);
          if (itemError) throw itemError;
        }
      }

      // Update reminder details
      const detailsUpdate: any = {};
      if (input.due_at !== undefined) detailsUpdate.due_at = input.due_at;
      if (input.estimate_minutes !== undefined)
        detailsUpdate.estimate_minutes = input.estimate_minutes;
      if (input.has_checklist !== undefined)
        detailsUpdate.has_checklist = input.has_checklist;
      if (input.completed_at !== undefined)
        detailsUpdate.completed_at = input.completed_at;

      if (Object.keys(detailsUpdate).length > 0) {
        const { error: detailsError } = await supabase
          .from("reminder_details")
          .update(detailsUpdate)
          .eq("item_id", itemId);
        if (detailsError) throw detailsError;
      }

      return itemId;
    },
    onSuccess: (itemId) => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({ queryKey: itemsKeys.detail(itemId) });
    },
  });
}

/** Update event details */
export function useUpdateEventDetails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      ...input
    }: UpdateEventInput & { itemId: string }) => {
      const supabase = supabaseBrowser();

      // Update base item
      if (
        Object.keys(input).some((k) =>
          [
            "title",
            "description",
            "priority",
            "status",
            "is_public",
            "archived_at",
          ].includes(k),
        )
      ) {
        const itemUpdate: any = {};
        if (input.title !== undefined) itemUpdate.title = input.title;
        if (input.description !== undefined)
          itemUpdate.description = input.description;
        if (input.priority !== undefined) itemUpdate.priority = input.priority;
        if (input.status !== undefined) itemUpdate.status = input.status;
        if (input.is_public !== undefined)
          itemUpdate.is_public = input.is_public;
        if (input.archived_at !== undefined)
          itemUpdate.archived_at = input.archived_at;

        if (Object.keys(itemUpdate).length > 0) {
          itemUpdate.updated_at = new Date().toISOString();
          const { error: itemError } = await supabase
            .from("items")
            .update(itemUpdate)
            .eq("id", itemId);
          if (itemError) throw itemError;
        }
      }

      // Update event details
      const detailsUpdate: any = {};
      if (input.start_at !== undefined) detailsUpdate.start_at = input.start_at;
      if (input.end_at !== undefined) detailsUpdate.end_at = input.end_at;
      if (input.all_day !== undefined) detailsUpdate.all_day = input.all_day;
      if (input.location_text !== undefined)
        detailsUpdate.location_text = input.location_text;

      if (Object.keys(detailsUpdate).length > 0) {
        const { error: detailsError } = await supabase
          .from("event_details")
          .update(detailsUpdate)
          .eq("item_id", itemId);
        if (detailsError) throw detailsError;
      }

      return itemId;
    },
    onSuccess: (itemId) => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
      queryClient.invalidateQueries({ queryKey: itemsKeys.detail(itemId) });
    },
  });
}

/** Delete an item */
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = supabaseBrowser();
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Archive an item (soft delete) */
export function useArchiveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("items")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Complete a reminder */
export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = supabaseBrowser();

      // Update item status
      const { error: itemError } = await supabase
        .from("items")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (itemError) throw itemError;

      // Update reminder details
      const { error: detailsError } = await supabase
        .from("reminder_details")
        .update({ completed_at: new Date().toISOString() })
        .eq("item_id", id);
      if (detailsError) throw detailsError;

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Toggle subtask completion */
export function useToggleSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const supabase = supabaseBrowser();
      const now = new Date().toISOString();

      if (done) {
        // When completing: cascade to all descendants
        // First, get all descendant subtask IDs using recursive query
        const { data: descendants, error: descError } = await supabase.rpc(
          "get_subtask_descendants",
          { root_subtask_id: id },
        );

        // If the RPC doesn't exist yet, just update the single subtask
        if (descError && descError.message.includes("does not exist")) {
          const { error } = await supabase
            .from("item_subtasks")
            .update({ done_at: now, updated_at: now })
            .eq("id", id);
          if (error) throw error;
          return { id, done, cascadedIds: [id] };
        }

        if (descError) throw descError;

        // Update the subtask and all descendants
        const allIds = [
          id,
          ...(descendants?.map((d: { id: string }) => d.id) || []),
        ];
        const { error } = await supabase
          .from("item_subtasks")
          .update({ done_at: now, updated_at: now })
          .in("id", allIds);

        if (error) throw error;
        return { id, done, cascadedIds: allIds };
      } else {
        // When un-completing: only un-complete the single subtask
        const { error } = await supabase
          .from("item_subtasks")
          .update({ done_at: null, updated_at: now })
          .eq("id", id);
        if (error) throw error;
        return { id, done, cascadedIds: [id] };
      }
    },
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: itemsKeys.all });

      // Snapshot all item list queries
      const previousQueries: {
        queryKey: readonly unknown[];
        data: ItemWithDetails[];
      }[] = [];
      queryClient
        .getQueriesData<ItemWithDetails[]>({ queryKey: itemsKeys.lists() })
        .forEach(([queryKey, data]) => {
          if (data) {
            previousQueries.push({ queryKey, data });
          }
        });

      // Helper to get all descendant IDs
      const getDescendantIds = (
        subtasks: Subtask[],
        parentId: string,
      ): string[] => {
        const children = subtasks.filter(
          (s) => s.parent_subtask_id === parentId,
        );
        return children.flatMap((c) => [
          c.id,
          ...getDescendantIds(subtasks, c.id),
        ]);
      };

      // Optimistically update the subtask in ALL item list queries
      queryClient.setQueriesData<ItemWithDetails[]>(
        { queryKey: itemsKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            if (!item.subtasks) return item;

            // Get all IDs to update (subtask + descendants if completing)
            const idsToUpdate = done
              ? [id, ...getDescendantIds(item.subtasks, id)]
              : [id];

            return {
              ...item,
              subtasks: item.subtasks.map((s) =>
                idsToUpdate.includes(s.id)
                  ? { ...s, done_at: done ? new Date().toISOString() : null }
                  : s,
              ),
            };
          });
        },
      );

      // Show toast for cascading completion
      const queriesData = queryClient.getQueriesData<ItemWithDetails[]>({
        queryKey: itemsKeys.lists(),
      });
      const itemsData = queriesData.flatMap(([, data]) => data || []);
      if (done && itemsData.length > 0) {
        const item = itemsData.find((i) =>
          i.subtasks?.some((s) => s.id === id),
        );
        if (item?.subtasks) {
          const descendantCount = getDescendantIds(item.subtasks, id).length;
          if (descendantCount > 0) {
            const subtask = item.subtasks.find((s) => s.id === id);
            toast.success(
              `Completed "${subtask?.title}" and ${descendantCount} sub-item${descendantCount > 1 ? "s" : ""}`,
              { duration: 3000 },
            );
          }
        }
      }

      return { previousQueries };
    },
    onError: (err, variables, context) => {
      // Rollback on error - restore all queries
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error("Failed to update subtask");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Create an item category */
export function useCreateItemCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; color_hex?: string }) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("item_categories")
        .insert({
          user_id: user.id,
          name: input.name,
          color_hex: input.color_hex,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ItemCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.categories() });
    },
  });
}

// ============================================
// SUBTASK HOOKS
// ============================================

export interface SubtaskCompletion {
  id: string;
  subtask_id: string;
  occurrence_date: string;
  completed_at: string;
  completed_by: string | null;
}

/** Fetch subtask completions for an item (for recurring items) */
export function useSubtaskCompletions(itemId: string | undefined) {
  return useQuery({
    queryKey: itemsKeys.subtaskCompletions(itemId),
    queryFn: async () => {
      if (!itemId) return [];
      const supabase = supabaseBrowser();

      // Get all subtask IDs for this item first
      const { data: subtasks, error: subtasksError } = await supabase
        .from("item_subtasks")
        .select("id")
        .eq("parent_item_id", itemId);

      if (subtasksError) throw subtasksError;
      if (!subtasks?.length) return [];

      const subtaskIds = subtasks.map((s) => s.id);

      const { data, error } = await supabase
        .from("item_subtask_completions")
        .select("*")
        .in("subtask_id", subtaskIds);

      if (error) throw error;
      return data as SubtaskCompletion[];
    },
    enabled: !!itemId,
    staleTime: 1000 * 60 * 2,
  });
}

/** Toggle subtask completion for a specific occurrence (for recurring items) */
export function useToggleSubtaskForOccurrence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtaskId,
      occurrenceDate,
      completed,
    }: {
      subtaskId: string;
      occurrenceDate: string;
      completed: boolean;
    }) => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Get all descendant IDs if completing
      let allIds = [subtaskId];
      if (completed) {
        const { data: descendants, error: descError } = await supabase.rpc(
          "get_subtask_descendants",
          { root_subtask_id: subtaskId },
        );

        // If RPC exists and returns descendants, include them
        if (!descError && descendants) {
          allIds = [subtaskId, ...descendants.map((d: { id: string }) => d.id)];
        }
      }

      if (completed) {
        // Insert completion records for subtask and all descendants
        const completionRecords = allIds.map((id) => ({
          subtask_id: id,
          occurrence_date: occurrenceDate,
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        }));

        const { data, error } = await supabase
          .from("item_subtask_completions")
          .upsert(completionRecords, {
            onConflict: "subtask_id,occurrence_date",
          })
          .select();

        if (error) throw error;
        return {
          subtaskId,
          occurrenceDate,
          completed,
          data,
          cascadedIds: allIds,
        };
      } else {
        // Delete completion record (only for the specific subtask, not descendants)
        const { error } = await supabase
          .from("item_subtask_completions")
          .delete()
          .eq("subtask_id", subtaskId)
          .eq("occurrence_date", occurrenceDate);

        if (error) throw error;
        return {
          subtaskId,
          occurrenceDate,
          completed,
          data: null,
          cascadedIds: [subtaskId],
        };
      }
    },
    onMutate: async ({ subtaskId, occurrenceDate, completed }) => {
      await queryClient.cancelQueries({ queryKey: itemsKeys.all });

      const previousCompletions = queryClient.getQueryData<SubtaskCompletion[]>(
        [...itemsKeys.all, "all-subtask-completions"],
      );

      // Helper to get all descendant IDs from items data
      const getDescendantIds = (
        subtasks: Subtask[],
        parentId: string,
      ): string[] => {
        const children = subtasks.filter(
          (s) => s.parent_subtask_id === parentId,
        );
        return children.flatMap((c) => [
          c.id,
          ...getDescendantIds(subtasks, c.id),
        ]);
      };

      // Get items data to find descendants
      const queriesData = queryClient.getQueriesData<ItemWithDetails[]>({
        queryKey: itemsKeys.lists(),
      });
      const itemsData = queriesData.flatMap(([, data]) => data || []);
      let allIds = [subtaskId];

      if (completed && itemsData.length > 0) {
        const item = itemsData.find((i) =>
          i.subtasks?.some((s) => s.id === subtaskId),
        );
        if (item?.subtasks) {
          allIds = [subtaskId, ...getDescendantIds(item.subtasks, subtaskId)];

          // Show toast for cascading completion
          const descendantCount = allIds.length - 1;
          if (descendantCount > 0) {
            const subtask = item.subtasks.find((s) => s.id === subtaskId);
            toast.success(
              `Completed "${subtask?.title}" and ${descendantCount} sub-item${descendantCount > 1 ? "s" : ""}`,
              { duration: 3000 },
            );
          }
        }
      }

      // Optimistically update the completions cache
      queryClient.setQueryData<SubtaskCompletion[]>(
        [...itemsKeys.all, "all-subtask-completions"],
        (old) => {
          if (!old) old = [];
          if (completed) {
            // Add completion records for all IDs
            const newCompletions = allIds.map((id) => ({
              id: `temp-${Date.now()}-${id}`,
              subtask_id: id,
              occurrence_date: occurrenceDate,
              completed_at: new Date().toISOString(),
              completed_by: null,
            }));
            return [...old, ...newCompletions];
          } else {
            // Remove completion (only for the specific subtask)
            return old.filter(
              (c) =>
                !(
                  c.subtask_id === subtaskId &&
                  c.occurrence_date === occurrenceDate
                ),
            );
          }
        },
      );

      return { previousCompletions };
    },
    onError: (err, variables, context) => {
      if (context?.previousCompletions) {
        queryClient.setQueryData(
          [...itemsKeys.all, "all-subtask-completions"],
          context.previousCompletions,
        );
      }
      toast.error("Failed to update subtask");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Add a new subtask to an item */
export function useAddSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      parentItemId,
      parentSubtaskId,
      title,
      occurrenceDate,
      orderIndex,
    }: {
      parentItemId: string;
      parentSubtaskId?: string; // For nested subtasks
      title: string;
      occurrenceDate?: string; // ISO string - for recurring items, which occurrence this subtask belongs to
      orderIndex?: number;
    }) => {
      const supabase = supabaseBrowser();

      // Get current max order_index if not provided
      let finalOrderIndex = orderIndex;
      if (finalOrderIndex === undefined) {
        // Query siblings (same parent_subtask_id)
        let query = supabase
          .from("item_subtasks")
          .select("order_index")
          .eq("parent_item_id", parentItemId)
          .order("order_index", { ascending: false })
          .limit(1);

        if (parentSubtaskId) {
          query = query.eq("parent_subtask_id", parentSubtaskId);
        } else {
          query = query.is("parent_subtask_id", null);
        }

        const { data: existing } = await query;

        finalOrderIndex = existing?.[0]?.order_index
          ? existing[0].order_index + 1
          : 0;
      }

      const { data, error } = await supabase
        .from("item_subtasks")
        .insert({
          parent_item_id: parentItemId,
          parent_subtask_id: parentSubtaskId || null,
          title,
          order_index: finalOrderIndex,
          occurrence_date: occurrenceDate || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Subtask;
    },
    onMutate: async ({
      parentItemId,
      parentSubtaskId,
      title,
      occurrenceDate,
    }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: itemsKeys.all });

      // Snapshot all item list queries
      const previousQueries: {
        queryKey: readonly unknown[];
        data: ItemWithDetails[];
      }[] = [];
      queryClient
        .getQueriesData<ItemWithDetails[]>({ queryKey: itemsKeys.lists() })
        .forEach(([queryKey, data]) => {
          if (data) {
            previousQueries.push({ queryKey, data });
          }
        });

      // Create optimistic subtask
      const optimisticSubtask: Subtask = {
        id: `temp-${Date.now()}`,
        parent_item_id: parentItemId,
        parent_subtask_id: parentSubtaskId || null,
        title,
        occurrence_date: occurrenceDate || null,
        done_at: null,
        order_index: 999, // Will be at end
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically update ALL item list queries
      queryClient.setQueriesData<ItemWithDetails[]>(
        { queryKey: itemsKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => {
            if (item.id === parentItemId) {
              return {
                ...item,
                subtasks: [...(item.subtasks || []), optimisticSubtask],
              };
            }
            return item;
          });
        },
      );

      return { previousQueries };
    },
    onError: (err, variables, context) => {
      // Rollback on error - restore all queries
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error("Failed to add subtask");
    },
    onSuccess: (createdSubtask) => {
      toast.success("Subtask added", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            const supabase = supabaseBrowser();
            await supabase
              .from("item_subtasks")
              .delete()
              .eq("id", createdSubtask.id);
            queryClient.invalidateQueries({ queryKey: itemsKeys.all });
            toast.success("Subtask removed");
          },
        },
      });
    },
    onSettled: () => {
      // Always refetch to sync with server
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Delete a subtask */
export function useDeleteSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subtaskId: string) => {
      const supabase = supabaseBrowser();

      // First, fetch the subtask data so we can restore it on Undo
      const { data: subtaskData } = await supabase
        .from("item_subtasks")
        .select("*")
        .eq("id", subtaskId)
        .single();

      const { error } = await supabase
        .from("item_subtasks")
        .delete()
        .eq("id", subtaskId);

      if (error) throw error;
      return { subtaskId, deletedSubtask: subtaskData };
    },
    onMutate: async (subtaskId) => {
      await queryClient.cancelQueries({ queryKey: itemsKeys.all });

      // Snapshot all item list queries
      const previousQueries: {
        queryKey: readonly unknown[];
        data: ItemWithDetails[];
      }[] = [];
      queryClient
        .getQueriesData<ItemWithDetails[]>({ queryKey: itemsKeys.lists() })
        .forEach(([queryKey, data]) => {
          if (data) {
            previousQueries.push({ queryKey, data });
          }
        });

      // Optimistically remove the subtask from ALL item list queries
      queryClient.setQueriesData<ItemWithDetails[]>(
        { queryKey: itemsKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((item) => ({
            ...item,
            subtasks: item.subtasks?.filter((s) => s.id !== subtaskId) || [],
          }));
        },
      );

      return { previousQueries };
    },
    onError: (err, variables, context) => {
      // Rollback on error - restore all queries
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error("Failed to delete subtask");
    },
    onSuccess: ({ deletedSubtask }) => {
      toast.success("Subtask removed", {
        duration: 4000,
        action: {
          label: "Undo",
          onClick: async () => {
            if (deletedSubtask) {
              const supabase = supabaseBrowser();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, created_at, updated_at, ...restoreData } =
                deletedSubtask;
              await supabase.from("item_subtasks").insert(restoreData);
              queryClient.invalidateQueries({ queryKey: itemsKeys.all });
              toast.success("Subtask restored");
            }
          },
        },
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Update subtask (title, priority, kanban_stage) */
export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      priority,
      kanban_stage,
    }: {
      id: string;
      title?: string;
      priority?: number | null;
      kanban_stage?: string | null;
    }) => {
      const supabase = supabaseBrowser();

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (title !== undefined) updateData.title = title;
      if (priority !== undefined) updateData.priority = priority;
      if (kanban_stage !== undefined) updateData.kanban_stage = kanban_stage;

      const { data, error } = await supabase
        .from("item_subtasks")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/**
 * Update subtask priority with automatic reordering.
 * Priority 1 = top (highest priority). If a priority number is already used,
 * the item is inserted at that position and all following items shift down by 1.
 */
export function useUpdateSubtaskPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtaskId,
      parentItemId,
      newPriority,
    }: {
      subtaskId: string;
      parentItemId: string;
      newPriority: number | null;
    }) => {
      const supabase = supabaseBrowser();

      // If setting to null, just clear the priority
      if (newPriority === null) {
        const { data, error } = await supabase
          .from("item_subtasks")
          .update({ priority: null, updated_at: new Date().toISOString() })
          .eq("id", subtaskId)
          .select()
          .single();
        if (error) throw error;
        return { updated: [data], shifted: [] };
      }

      // Get all sibling subtasks with priorities
      const { data: siblings, error: siblingsError } = await supabase
        .from("item_subtasks")
        .select("id, priority")
        .eq("parent_item_id", parentItemId)
        .not("priority", "is", null)
        .order("priority", { ascending: true });

      if (siblingsError) throw siblingsError;

      // Find subtasks that need to shift (priority >= newPriority, excluding the one being updated)
      const toShift = (siblings || []).filter(
        (s) =>
          s.id !== subtaskId &&
          s.priority !== null &&
          s.priority >= newPriority,
      );

      // Shift all affected subtasks down by 1
      const shiftedIds: string[] = [];
      for (const s of toShift) {
        const { error: shiftError } = await supabase
          .from("item_subtasks")
          .update({
            priority: (s.priority as number) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.id);
        if (shiftError) throw shiftError;
        shiftedIds.push(s.id);
      }

      // Update the target subtask with the new priority
      const { data, error } = await supabase
        .from("item_subtasks")
        .update({ priority: newPriority, updated_at: new Date().toISOString() })
        .eq("id", subtaskId)
        .select()
        .single();

      if (error) throw error;
      return { updated: [data], shifted: shiftedIds };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Update subtask kanban stage with optimistic UI */
export function useUpdateSubtaskKanbanStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subtaskId,
      kanbanStage,
      parentItemId,
      previousKanbanStage,
    }: {
      subtaskId: string;
      kanbanStage: string;
      parentItemId: string;
      previousKanbanStage?: string | null; // Store previous stage when moving to Later
    }) => {
      const supabase = supabaseBrowser();

      const updateData: Record<string, unknown> = {
        kanban_stage: kanbanStage,
        updated_at: new Date().toISOString(),
      };

      // If previousKanbanStage is provided, update it (for moving to Later)
      // If it's null, clear it (for moving back from Later)
      if (previousKanbanStage !== undefined) {
        updateData.previous_kanban_stage = previousKanbanStage;
      }

      const { data, error } = await supabase
        .from("item_subtasks")
        .update(updateData)
        .eq("id", subtaskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({
      subtaskId,
      kanbanStage,
      parentItemId,
      previousKanbanStage,
    }) => {
      // Cancel any outgoing refetches for all item queries
      await queryClient.cancelQueries({ queryKey: itemsKeys.all });

      // Helper to update subtask in an item array
      const updateItemsArray = (items: ItemWithDetails[] | undefined) => {
        if (!items) return items;
        return items.map((item) => {
          if (item.id !== parentItemId) return item;
          return {
            ...item,
            subtasks: item.subtasks?.map((subtask) =>
              subtask.id === subtaskId
                ? {
                    ...subtask,
                    kanban_stage: kanbanStage,
                    ...(previousKanbanStage !== undefined && {
                      previous_kanban_stage: previousKanbanStage,
                    }),
                  }
                : subtask,
            ),
          };
        });
      };

      // Snapshot all queries and update them optimistically
      const previousQueries: Array<{ queryKey: unknown; data: unknown }> = [];

      // Get all queries that start with itemsKeys.all
      const allQueries = queryClient.getQueriesData<ItemWithDetails[]>({
        queryKey: itemsKeys.all,
      });

      for (const [queryKey, data] of allQueries) {
        if (Array.isArray(data)) {
          previousQueries.push({ queryKey, data });
          queryClient.setQueryData(queryKey, updateItemsArray(data));
        }
      }

      return { previousQueries };
    },
    onError: (_err, _variables, context) => {
      // Rollback all queries on error
      if (context?.previousQueries) {
        for (const { queryKey, data } of context.previousQueries) {
          queryClient.setQueryData(queryKey as readonly unknown[], data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Update item kanban settings (enable/disable, stage names) */
export function useUpdateItemKanbanSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      kanbanEnabled,
      kanbanStages,
    }: {
      itemId: string;
      kanbanEnabled?: boolean;
      kanbanStages?: string[];
    }) => {
      const supabase = supabaseBrowser();

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (kanbanEnabled !== undefined)
        updateData.subtask_kanban_enabled = kanbanEnabled;
      if (kanbanStages !== undefined)
        updateData.subtask_kanban_stages = kanbanStages;

      const { data, error } = await supabase
        .from("items")
        .update(updateData)
        .eq("id", itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    },
  });
}

/** Fetch all subtask completions for all user's items */
export function useAllSubtaskCompletions() {
  return useQuery({
    queryKey: [...itemsKeys.all, "all-subtask-completions"],
    queryFn: async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      // Get all subtask IDs for user's items
      const { data: subtasks, error: subtasksError } = await supabase
        .from("item_subtasks")
        .select("id, parent_item_id, items!inner(user_id)")
        .eq("items.user_id", user.id);

      if (subtasksError) {
        console.error("Error fetching subtasks:", subtasksError);
        return [];
      }
      if (!subtasks?.length) return [];

      const subtaskIds = subtasks.map((s) => s.id);

      // Get completions for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("item_subtask_completions")
        .select("*")
        .in("subtask_id", subtaskIds)
        .gte("occurrence_date", thirtyDaysAgo.toISOString());

      if (error) {
        console.error("Error fetching subtask completions:", error);
        return [];
      }
      return data as SubtaskCompletion[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}
