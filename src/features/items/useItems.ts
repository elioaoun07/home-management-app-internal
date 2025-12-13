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
  UpdateEventInput,
  UpdateItemInput,
  UpdateReminderInput,
} from "@/types/items";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
};

// ============================================
// FETCH FUNCTIONS
// ============================================

async function fetchItems(
  filters?: ItemsFilter,
  sort?: ItemsSort
): Promise<ItemWithDetails[]> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("items")
    .select(
      `
      *,
      reminder_details (*),
      event_details (*),
      item_subtasks (*),
      item_alerts (*)
    `
    )
    .eq("user_id", user.id)
    .is("archived_at", null);

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
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
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

  // Transform the data to match our types
  return (data || []).map((item: any) => ({
    ...item,
    categories: [], // Categories are now hardcoded, not stored per item
    subtasks: item.item_subtasks || [],
    alerts: item.item_alerts || [],
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
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return {
    ...data,
    categories: [], // Categories are now hardcoded, not stored per item
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
        const alerts = input.alerts.map((a) => ({
          item_id: item.id,
          kind: a.kind,
          trigger_at: a.trigger_at,
          offset_minutes: a.offset_minutes,
          relative_to: a.relative_to,
          repeat_every_minutes: a.repeat_every_minutes,
          max_repeats: a.max_repeats,
          channel: a.channel || "push",
        }));
        const { error: alertsError } = await supabase
          .from("item_alerts")
          .insert(alerts);
        if (alertsError) throw alertsError;
      } else if (input.due_at) {
        // Auto-create a push alert at the due time if no alerts provided
        console.log("[useCreateReminder] Creating auto-alert for due_at:", input.due_at);
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
          throw new Error(`Reminder created but alert failed: ${alertsError.message}`);
        } else {
          console.log("[useCreateReminder] Auto-alert created:", alertData);
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
        const alerts = input.alerts.map((a) => ({
          item_id: item.id,
          kind: a.kind,
          trigger_at: a.trigger_at,
          offset_minutes: a.offset_minutes,
          relative_to: a.relative_to,
          repeat_every_minutes: a.repeat_every_minutes,
          max_repeats: a.max_repeats,
          channel: a.channel || "push",
        }));
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
          ].includes(k)
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
          ].includes(k)
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
      const { error } = await supabase
        .from("item_subtasks")
        .update({
          done_at: done ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      return { id, done };
    },
    onSuccess: () => {
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
