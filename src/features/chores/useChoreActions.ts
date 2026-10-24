"use client";

import { isRecurringItem, useBulkComplete } from "@/features/items/bulkComplete";
import { useBulkItems } from "@/features/items/bulkItems";
import { useItemActionsWithToast } from "@/features/items/useItemActions";
import {
  useScheduleRoutine,
  useUnscheduleRoutine,
} from "@/features/items/useFlexibleRoutines";
import {
  useUpdateItem,
  useUpdateReminderDetails,
} from "@/features/items/useItems";
import {
  getMemberDisplayName,
  useHouseholdMembers,
} from "@/hooks/useHouseholdMembers";
import { supabaseBrowser } from "@/lib/supabase/client";
import { buildTemplateInstanceInput } from "@/lib/schedule/catalogueInstance";
import { ToastIcons } from "@/lib/toastIcons";
import { localToISO } from "@/lib/utils/date";
import type { CatalogueItem } from "@/types/catalogue";
import type { FlexibleSchedule, ItemWithDetails } from "@/types/items";
import { addDays, addWeeks, endOfWeek, format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ALL_DAY_TIME,
  nextFreeOccurrenceIndex,
  type ChoreSlot,
} from "./choreWeek";
import { itemsKeys } from "@/features/items/useItems";

/** One template placement of the Assign form's batch save. */
export interface ChorePlacement {
  tpl: CatalogueItem;
  date: string;
  time: string | null;
  responsibleUserId?: string;
  room?: { id: string; name: string };
}

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

/** Items whose complete / reopen request is still going out (taps meanwhile are ignored). */
const inFlight = new Set<string>();

/**
 * Complete / reopen / skip / postpone one chore slot. Done and Reopen go through
 * the same optimistic, idempotent, queueable path as a grouped completion: the
 * row flips before the request leaves. Skip and postpone keep the existing
 * occurrence primitives.
 */
export function useChoreSlotActions(slot: ChoreSlot) {
  const actions = useItemActionsWithToast();
  const { completeMany, reopenMany } = useBulkComplete();
  const { data: household } = useHouseholdMembers();
  const plannedAt = slot.plannedAt;
  const item = slot.item;

  // Someone else owns it: ask once, like every other completion does
  const guard = (onConfirm: () => void): boolean => {
    const me = household?.currentUserId ?? null;
    const owner = item.responsible_user_id;
    if (!me || !owner || owner === me) return false;
    toast.warning(
      `${getMemberDisplayName(household?.members ?? [], owner) || "Your partner"} is responsible for this`,
      {
        icon: ToastIcons.partner,
        duration: 6000,
        action: { label: "Override", onClick: onConfirm },
      },
    );
    return true;
  };

  const send = async (completedAt: string, plannedFor: string) => {
    if (inFlight.has(item.id)) return;
    inFlight.add(item.id);
    try {
      const result = await completeMany([
        { item, occurrenceDate: completedAt, plannedFor },
      ]);
      const completed = [...result.done, ...result.queued];
      if (completed.length === 0) {
        notSaved();
        return;
      }
      toast.success(`"${item.title}" completed!`, {
        icon: ToastIcons.success,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            void reopenMany(completed).then(({ ok }) => {
              if (!ok) notSaved();
            });
          },
        },
      });
    } finally {
      inFlight.delete(item.id);
    }
  };

  const completeAt = (completedAt: string, override = false): Promise<void> => {
    if (!override && guard(() => void completeAt(completedAt, true))) {
      return Promise.resolve();
    }
    void send(completedAt, plannedAt);
    return Promise.resolve();
  };

  const complete = () => completeAt(new Date().toISOString());

  const reopen = (override = false): Promise<void> => {
    if (!override && guard(() => void reopen(true))) return Promise.resolve();
    if (inFlight.has(item.id)) return Promise.resolve();
    const entry = {
      item_id: item.id,
      occurrence_date: slot.completedAction?.occurrence_date ?? plannedAt,
      is_recurring: isRecurringItem(item),
    };
    const plannedFor =
      typeof slot.completedAction?.metadata_json?.planned_for === "string"
        ? slot.completedAction.metadata_json.planned_for
        : plannedAt;
    inFlight.add(item.id);
    void reopenMany([entry])
      .then(({ ok }) => {
        if (!ok) {
          notSaved();
          return;
        }
        toast.success(`"${item.title}" marked as pending`, {
          icon: ToastIcons.update,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              void completeMany([
                {
                  item,
                  occurrenceDate: entry.occurrence_date,
                  plannedFor,
                },
              ]).then((result) => {
                if (result.refused.length > 0) notSaved();
              });
            },
          },
        });
      })
      .finally(() => inFlight.delete(item.id));
    return Promise.resolve();
  };

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

/**
 * Complete every open slot of a grouped chore ("Sweep floor" in 9 rooms) in one
 * bulk request: done at once, one toast, one Undo. Slots someone else owns ask
 * for an Override first, like a single completion does.
 */
export function useChoreGroupComplete(
  currentUserId: string | null,
  ownerLabel: (userId: string) => string,
) {
  const { completeMany, reopenMany } = useBulkComplete();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = async (key: string, title: string, open: ChoreSlot[]) => {
    setPendingKey(key);
    const now = new Date().toISOString();
    const result = await completeMany(
      open.map((slot) => ({
        item: slot.item,
        occurrenceDate: now,
        plannedFor: slot.plannedAt,
      })),
    );
    setPendingKey(null);
    if (result.refused.length > 0) {
      toast.error(`${result.refused.length} not saved`, {
        icon: ToastIcons.error,
      });
    }
    const completed = [...result.done, ...result.queued];
    if (completed.length === 0) return;
    toast.success(`${title} · ${completed.length}`, {
      icon: ToastIcons.success,
      duration: 4000,
      action: {
        label: "Undo",
        onClick: () => {
          void reopenMany(completed).then(({ ok }) => {
            if (!ok) notSaved();
          });
        },
      },
    });
  };

  const completeGroup = (key: string, title: string, slots: ChoreSlot[]) => {
    const open = slots.filter((slot) => !slot.done);
    if (open.length === 0 || pendingKey) return;
    const other = currentUserId
      ? open.find(
          (slot) =>
            slot.item.responsible_user_id &&
            slot.item.responsible_user_id !== currentUserId,
        )
      : undefined;
    if (other?.item.responsible_user_id) {
      toast.warning(
        `${ownerLabel(other.item.responsible_user_id)} is responsible for this`,
        {
          icon: ToastIcons.partner,
          duration: 6000,
          action: { label: "Override", onClick: () => void run(key, title, open) },
        },
      );
      return;
    }
    void run(key, title, open);
  };

  return { completeGroup, pendingKey };
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
  const updateReminder = useUpdateReminderDetails();
  const updateItem = useUpdateItem();
  const queryClient = useQueryClient();
  const bulk = useBulkItems();

  const isPending =
    scheduleRoutine.isPending ||
    unscheduleRoutine.isPending ||
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
    // The slot shows at once; the hand-over (a person was picked) runs beside it
    const placed = scheduleRoutine
      .mutateAsync({
        itemId: item.id,
        periodStartDate: periodStart,
        scheduledForDate: date,
        scheduledForTime: time,
        occurrenceIndex,
      })
      .then(
        () => true,
        () => false,
      );
    const undoHandOver = await handOver(item, responsibleUserId);
    const ok = await placed;
    if (!undoHandOver || !ok) {
      // All or nothing: take back whichever half did go through
      if (ok) {
        unscheduleRoutine.mutate(
          { itemId: item.id, periodStartDate: periodStart, occurrenceIndex },
          { onError: notSaved },
        );
      }
      if (undoHandOver && !ok) undoHandOver();
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
    room?: { id: string; name: string },
    userId: string | null = null,
  ) => {
    // Same optimistic, idempotent, queueable path as the Assign form's Save:
    // the row is on the agenda before the request leaves, so don't wait for it
    void (async () => {
      const result = await bulk.createMany(
        [
          buildTemplateInstanceInput(tpl, dueAt(date, time), responsibleUserId, {
            allDay: time === null,
            room,
          }),
        ],
        { userId },
      );
      const created = [...result.saved, ...result.queued];
      if (created.length === 0) {
        notSaved();
        return;
      }
      toast.success(`${room ? `${tpl.name} · ${room.name}` : tpl.name} · ${dayLabel(date)}`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            void bulk.deleteMany(created).then(({ ok }) => {
              if (!ok) notSaved();
            });
          },
        },
      });
    })();
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

  /**
   * Places many template chores at once (Assign form → Save). They are on the
   * agenda before the first request leaves; the batch then goes out as a few
   * idempotent requests, or waits in the offline queue. One toast, one Undo.
   * Returns the input positions the server refused, so the form can stage them
   * again.
   */
  const placeTemplates = async (
    placements: ChorePlacement[],
    userId: string | null,
  ): Promise<number[]> => {
    const result = await bulk.createMany(
      placements.map((p) =>
        buildTemplateInstanceInput(
          p.tpl,
          dueAt(p.date, p.time),
          p.responsibleUserId,
          { allDay: p.time === null, room: p.room },
        ),
      ),
      { userId },
    );
    const refused = result.rejected.map((entry) => entry.index);
    if (refused.length > 0) {
      toast.error(`${refused.length} not saved`, { icon: ToastIcons.error });
    }
    // Queued rows are on this device and will sync, so they count as assigned
    const created = [...result.saved, ...result.queued];
    if (created.length > 0) {
      toast.success(`${created.length} assigned`, {
        icon: ToastIcons.create,
        duration: 4000,
        action: {
          label: "Undo",
          onClick: () => {
            void bulk.deleteMany(created).then(({ ok }) => {
              if (!ok) notSaved();
            });
          },
        },
      });
    }
    return refused;
  };

  return {
    unassignOneOff,
    placeFlexible,
    placeTemplate,
    placeTemplates,
    placeUndated,
    moveFlexible,
    unassignFlexible,
    isPending,
  };
}
