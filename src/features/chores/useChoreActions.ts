"use client";

import { useItemActionsWithToast } from "@/features/items/useItemActions";
import {
  useScheduleRoutine,
  useUnscheduleRoutine,
} from "@/features/items/useFlexibleRoutines";
import {
  useCreateReminder,
  useCreateTask,
  useDeleteItem,
  useUpdateItem,
  useUpdateReminderDetails,
} from "@/features/items/useItems";
import { supabaseBrowser } from "@/lib/supabase/client";
import { buildTemplateInstanceInput } from "@/lib/schedule/catalogueInstance";
import { ToastIcons } from "@/lib/toastIcons";
import { localToISO } from "@/lib/utils/date";
import type { CatalogueItem } from "@/types/catalogue";
import type { FlexibleSchedule, ItemWithDetails } from "@/types/items";
import { addDays, addWeeks, endOfWeek, format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ALL_DAY_TIME,
  nextFreeOccurrenceIndex,
  type ChoreSlot,
} from "./choreWeek";
import { itemsKeys } from "@/features/items/useItems";

export type ChorePostponeTarget =
  | "tomorrow"
  | "end_of_week"
  | "next_week"
  | "custom";

function dayLabel(date: string): string {
  return format(parseISO(date), "EEE d");
}

function notSaved() {
  toast.error("Not saved", { icon: ToastIcons.error });
}

/** Complete / reopen / skip / postpone one chore slot (existing occurrence primitives). */
export function useChoreSlotActions(slot: ChoreSlot) {
  const actions = useItemActionsWithToast();
  const plannedAt = slot.plannedAt;
  const item = slot.item;

  const complete = () =>
    actions.handleComplete(
      item,
      new Date().toISOString(),
      undefined,
      undefined,
      false,
      plannedAt,
    );

  const completeAt = (completedAt: string) =>
    actions.handleComplete(
      item,
      completedAt,
      undefined,
      undefined,
      false,
      plannedAt,
    );

  const reopen = () =>
    actions.handleUncomplete(
      item,
      slot.completedAction?.occurrence_date ?? plannedAt,
    );

  const skip = (reason?: string) =>
    actions.handleSkip(item, plannedAt, reason, false, plannedAt);

  const postpone = (to: ChorePostponeTarget, customDate?: string) => {
    const plannedDate = parseISO(plannedAt);
    const plannedTime = format(plannedDate, "HH:mm");
    const at = (date: Date) =>
      localToISO(format(date, "yyyy-MM-dd"), plannedTime);

    if (to === "tomorrow") {
      return actions.handlePostpone(
        item,
        plannedAt,
        "tomorrow",
        undefined,
        at(addDays(plannedDate, 1)),
      );
    }
    if (to === "end_of_week") {
      return actions.handlePostpone(
        item,
        plannedAt,
        "custom",
        undefined,
        at(endOfWeek(plannedDate, { weekStartsOn: 1 })),
      );
    }
    if (to === "next_week") {
      return actions.handlePostpone(
        item,
        plannedAt,
        "custom",
        undefined,
        at(addWeeks(plannedDate, 1)),
      );
    }
    if (to === "custom" && customDate) {
      return actions.handlePostpone(
        item,
        plannedAt,
        "custom",
        undefined,
        localToISO(customDate, plannedTime),
      );
    }
  };

  return {
    complete,
    completeAt,
    reopen,
    skip,
    postpone,
    isPending: actions.isLoading,
  };
}

/** Change who is responsible for a chore item (item-level, not per slot). */
export function useChoreResponsibility() {
  const updateItem = useUpdateItem();

  const setResponsible = (
    item: ItemWithDetails,
    userId: string,
    label: string,
  ) => {
    const previous = item.responsible_user_id ?? null;
    updateItem.mutate(
      { id: item.id, responsible_user_id: userId },
      {
        onSuccess: () =>
          toast.success(`${item.title} · ${label}`, {
            icon: ToastIcons.partner,
            duration: 4000,
            action: {
              label: "Undo",
              onClick: () =>
                updateItem.mutate(
                  { id: item.id, responsible_user_id: previous },
                  { onError: notSaved },
                ),
            },
          }),
        onError: notSaved,
      },
    );
  };

  return { setResponsible, isPending: updateItem.isPending };
}

/** null time = all day */
function dueAt(date: string, time: string | null): string {
  return localToISO(date, time ?? ALL_DAY_TIME);
}

/**
 * Place chores on a day. Three existing write paths, unchanged:
 *  - flexible routine  → item_flexible_schedules slot (upsert by item/period/index)
 *  - Catalogue template without a routine → one-off item + push alert at due time
 *  - undated one-off   → sets reminder_details.due_at (no alert added)
 */
export function useChoreAssign(schedules: FlexibleSchedule[]) {
  const scheduleRoutine = useScheduleRoutine();
  const unscheduleRoutine = useUnscheduleRoutine();
  const createReminder = useCreateReminder();
  const createTask = useCreateTask();
  const deleteItem = useDeleteItem();
  const updateReminder = useUpdateReminderDetails();
  const updateItem = useUpdateItem();
  const queryClient = useQueryClient();

  const isPending =
    scheduleRoutine.isPending ||
    unscheduleRoutine.isPending ||
    createReminder.isPending ||
    createTask.isPending ||
    deleteItem.isPending ||
    updateReminder.isPending ||
    updateItem.isPending;

  /**
   * Responsibility is item-level for routines; a swipe hands the routine over
   * before placing it. Returns the undo, or null if the write failed.
   */
  const handOver = async (
    item: ItemWithDetails,
    responsibleUserId: string | undefined,
  ): Promise<(() => void) | null> => {
    const previous = item.responsible_user_id ?? null;
    if (!responsibleUserId || responsibleUserId === previous) return () => {};
    try {
      await updateItem.mutateAsync({
        id: item.id,
        responsible_user_id: responsibleUserId,
      });
    } catch {
      return null;
    }
    return () =>
      updateItem.mutate(
        { id: item.id, responsible_user_id: previous },
        { onError: notSaved },
      );
  };

  const placeFlexible = async (
    item: ItemWithDetails,
    periodStart: string,
    date: string,
    time: string | null,
    responsibleUserId?: string,
  ) => {
    const occurrenceIndex = nextFreeOccurrenceIndex(
      schedules,
      item.id,
      periodStart,
    );
    const undoHandOver = await handOver(item, responsibleUserId);
    if (!undoHandOver) {
      notSaved();
      return;
    }
    try {
      await scheduleRoutine.mutateAsync({
        itemId: item.id,
        periodStartDate: periodStart,
        scheduledForDate: date,
        scheduledForTime: time,
        occurrenceIndex,
      });
    } catch {
      notSaved();
      return;
    }
    toast.success(`${item.title} · ${dayLabel(date)}`, {
      icon: ToastIcons.create,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          undoHandOver();
          unscheduleRoutine.mutate(
            { itemId: item.id, periodStartDate: periodStart, occurrenceIndex },
            { onError: notSaved },
          );
        },
      },
    });
  };

  const placeTemplate = async (
    tpl: CatalogueItem,
    date: string,
    time: string | null,
    responsibleUserId: string | undefined,
  ) => {
    const input = buildTemplateInstanceInput(
      tpl,
      dueAt(date, time),
      responsibleUserId,
      { allDay: time === null },
    );
    let createdId: string | undefined;
    try {
      const created =
        input.type === "reminder"
          ? await createReminder.mutateAsync(input)
          : await createTask.mutateAsync(input);
      createdId = created?.id;
    } catch {
      notSaved();
      return;
    }
    if (!createdId) {
      notSaved();
      return;
    }
    const id = createdId;
    toast.success(`${tpl.name} · ${dayLabel(date)}`, {
      icon: ToastIcons.create,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => deleteItem.mutate(id, { onError: notSaved }),
      },
    });
  };

  const placeUndated = async (
    item: ItemWithDetails,
    date: string,
    time: string | null,
    responsibleUserId?: string,
  ) => {
    const previousMeta = item.metadata_json ?? null;
    const allDay = time === null;
    const metaChanges = allDay !== (previousMeta?.all_day === true);
    const previousOwner = item.responsible_user_id ?? null;
    const ownerChanges =
      !!responsibleUserId && responsibleUserId !== previousOwner;
    try {
      if (metaChanges || ownerChanges) {
        await updateItem.mutateAsync({
          id: item.id,
          ...(metaChanges && {
            metadata_json: { ...(previousMeta ?? {}), all_day: allDay },
          }),
          ...(ownerChanges && { responsible_user_id: responsibleUserId }),
        });
      }
      await updateReminder.mutateAsync({
        itemId: item.id,
        due_at: dueAt(date, time),
      });
    } catch {
      notSaved();
      return;
    }
    toast.success(`${item.title} · ${dayLabel(date)}`, {
      icon: ToastIcons.update,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          if (metaChanges || ownerChanges) {
            updateItem.mutate(
              {
                id: item.id,
                ...(metaChanges && { metadata_json: previousMeta }),
                ...(ownerChanges && { responsible_user_id: previousOwner }),
              },
              { onError: notSaved },
            );
          }
          updateReminder.mutate(
            { itemId: item.id, due_at: null },
            { onError: notSaved },
          );
        },
      },
    });
  };

  /** Move an open flexible slot to another day in its period — same slot, no new occurrence. */
  const moveFlexible = async (slot: ChoreSlot, date: string) => {
    const flex = slot.flexible;
    if (!flex || date === slot.date) return;
    const base = {
      itemId: slot.item.id,
      periodStartDate: flex.periodStart,
      occurrenceIndex: flex.occurrenceIndex,
      scheduledForTime: slot.time,
    };
    try {
      await scheduleRoutine.mutateAsync({ ...base, scheduledForDate: date });
    } catch {
      notSaved();
      return;
    }
    toast.success(`${slot.item.title} · ${dayLabel(date)}`, {
      icon: ToastIcons.update,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          scheduleRoutine.mutate(
            { ...base, scheduledForDate: slot.date },
            { onError: notSaved },
          ),
      },
    });
  };

  /** Remove one open flexible slot; the chore returns to Unassigned. */
  const unassignFlexible = async (slot: ChoreSlot) => {
    const flex = slot.flexible;
    if (!flex) return;
    const identity = {
      itemId: slot.item.id,
      periodStartDate: flex.periodStart,
      occurrenceIndex: flex.occurrenceIndex,
    };
    try {
      await unscheduleRoutine.mutateAsync(identity);
    } catch {
      notSaved();
      return;
    }
    toast.success(`${slot.item.title} · unassigned`, {
      icon: ToastIcons.delete,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () =>
          scheduleRoutine.mutate(
            {
              ...identity,
              scheduledForDate: slot.date,
              scheduledForTime: slot.time,
            },
            { onError: notSaved },
          ),
      },
    });
  };

  /**
   * Take back a one-off placement. Catalogue instances are cancelled (alerts
   * off) and return to Unassigned; other dated items just lose their due date.
   */
  const unassignOneOff = async (slot: ChoreSlot) => {
    const item = slot.item;
    const fromTemplate =
      !!item.is_template_instance && !!item.source_catalogue_item_id;
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });

    if (!fromTemplate) {
      const previous = item.reminder_details?.due_at ?? null;
      try {
        await updateReminder.mutateAsync({ itemId: item.id, due_at: null });
      } catch {
        notSaved();
        return;
      }
      toast.success(`${item.title} · unassigned`, {
        icon: ToastIcons.delete,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () =>
            updateReminder.mutate(
              { itemId: item.id, due_at: previous },
              { onError: notSaved },
            ),
        },
      });
      return;
    }

    const setState = async (
      status: "cancelled" | "pending",
      alertsActive: boolean,
    ) => {
      const supabase = supabaseBrowser();
      const { error } = await supabase
        .from("items")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw error;
      await supabase
        .from("item_alerts")
        .update({ active: alertsActive })
        .eq("item_id", item.id);
      refresh();
    };
    try {
      await setState("cancelled", false);
    } catch {
      notSaved();
      return;
    }
    toast.success(`${item.title} · unassigned`, {
      icon: ToastIcons.delete,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => setState("pending", true).catch(notSaved),
      },
    });
  };

  return {
    unassignOneOff,
    placeFlexible,
    placeTemplate,
    placeUndated,
    moveFlexible,
    unassignFlexible,
    isPending,
  };
}
