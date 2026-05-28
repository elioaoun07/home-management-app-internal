"use client";

import { useItemActionsWithToast } from "@/features/items/useItemActions";
import {
  flexibleRoutinesKeys,
  useScheduleRoutine,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import { useUpdateItem } from "@/features/items/useItems";
import { supabaseBrowser } from "@/lib/supabase/client";
import { localToISO } from "@/lib/utils/date";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, endOfWeek, format, parseISO } from "date-fns";

async function fetchHouseholdPartner(): Promise<{
  partnerId: string | null;
} | null> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .single();

  if (!link) return { partnerId: null };
  const partnerId =
    link.owner_user_id === user.id ? link.partner_user_id : link.owner_user_id;
  return { partnerId: partnerId ?? null };
}

export function useHouseholdPartner() {
  return useQuery({
    queryKey: ["household", "partner"],
    queryFn: fetchHouseholdPartner,
    staleTime: 1000 * 60 * 60,
  });
}

export type ChorePostponeTarget =
  | "tomorrow"
  | "end_of_week"
  | "next_week"
  | "custom";

export function getChorePlannedAt(entry: FlexibleRoutineItem): string {
  if (entry.flexibleSchedule?.scheduled_for_date) {
    return localToISO(
      entry.flexibleSchedule.scheduled_for_date,
      entry.flexibleSchedule.scheduled_for_time?.slice(0, 5) || "12:00",
    );
  }

  if (entry.reminder_details?.due_at) {
    return entry.reminder_details.due_at;
  }

  return new Date().toISOString();
}

export function useChoreActions(entry: FlexibleRoutineItem) {
  const actions = useItemActionsWithToast();
  const updateItem = useUpdateItem();
  const scheduleRoutine = useScheduleRoutine();
  const queryClient = useQueryClient();
  const { data: householdPartner } = useHouseholdPartner();

  const plannedOccurrenceDate = getChorePlannedAt(entry);
  const completedOccurrenceDate =
    entry.completedAction?.occurrence_date ?? plannedOccurrenceDate;

  const complete = () =>
    actions.handleComplete(
      entry,
      new Date().toISOString(),
      undefined,
      undefined,
      false,
      plannedOccurrenceDate,
    );

  const completeAt = (completedAt: string, reason?: string) =>
    actions.handleComplete(
      entry,
      completedAt,
      reason,
      undefined,
      false,
      plannedOccurrenceDate,
    );

  const reopen = () =>
    actions.handleUncomplete(entry, completedOccurrenceDate);

  const skip = (reason?: string) =>
    actions.handleSkip(
      entry,
      plannedOccurrenceDate,
      reason,
      false,
      plannedOccurrenceDate,
    );

  const postpone = (to: ChorePostponeTarget, customDate?: string) => {
    const plannedDate = parseISO(plannedOccurrenceDate);
    const plannedTime = format(plannedDate, "HH:mm");
    const toPostponedISO = (date: Date) =>
      localToISO(format(date, "yyyy-MM-dd"), plannedTime);

    if (to === "tomorrow") {
      return actions.handlePostpone(
        entry,
        plannedOccurrenceDate,
        "tomorrow",
        undefined,
        toPostponedISO(addDays(plannedDate, 1)),
      );
    }

    if (to === "end_of_week") {
      return actions.handlePostpone(
        entry,
        plannedOccurrenceDate,
        "custom",
        undefined,
        toPostponedISO(endOfWeek(plannedDate, { weekStartsOn: 1 })),
      );
    }

    if (to === "next_week") {
      return actions.handlePostpone(
        entry,
        plannedOccurrenceDate,
        "custom",
        undefined,
        toPostponedISO(addWeeks(plannedDate, 1)),
      );
    }

    if (to === "custom" && customDate) {
      return actions.handlePostpone(
        entry,
        plannedOccurrenceDate,
        "custom",
        undefined,
        localToISO(customDate, plannedTime),
      );
    }
  };

  const transferToPartner = () => {
    const partnerId = householdPartner?.partnerId;
    if (!partnerId) return;
    updateItem.mutate(
      { id: entry.id, responsible_user_id: partnerId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: flexibleRoutinesKeys.all });
        },
      },
    );
  };

  const scheduleToday = (periodStartDate: string) =>
    scheduleRoutine.mutate({
      itemId: entry.id,
      periodStartDate,
      scheduledForDate: format(new Date(), "yyyy-MM-dd"),
      occurrenceIndex: entry.scheduledOccurrences?.length ?? 0,
    });

  return {
    complete,
    completeAt,
    reopen,
    skip,
    postpone,
    transferToPartner,
    scheduleToday,
    hasPartner: !!householdPartner?.partnerId,
  };
}
