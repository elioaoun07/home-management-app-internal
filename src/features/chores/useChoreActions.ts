"use client";

import { useItemActionsWithToast } from "@/features/items/useItemActions";
import {
  useScheduleRoutine,
  type FlexibleRoutineItem,
} from "@/features/items/useFlexibleRoutines";
import { useUpdateItem } from "@/features/items/useItems";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addWeeks, endOfWeek, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// Household partner lookup (cached per session)
// ─────────────────────────────────────────────────────────────────────────────

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
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Chore-specific actions hook
// ─────────────────────────────────────────────────────────────────────────────

export type ChorePostponeTarget = "tomorrow" | "end_of_week" | "next_week" | "custom";

export function useChoreActions(entry: FlexibleRoutineItem) {
  const actions = useItemActionsWithToast();
  const updateItem = useUpdateItem();
  const scheduleRoutine = useScheduleRoutine();
  const { data: householdPartner } = useHouseholdPartner();

  const occurrenceDateStr = entry.flexibleSchedule?.scheduled_for_date
    ? entry.flexibleSchedule.scheduled_for_date + "T12:00:00.000Z"
    : new Date().toISOString();

  const complete = () =>
    actions.handleComplete(entry, occurrenceDateStr);

  const reopen = () =>
    actions.handleUncomplete(entry, occurrenceDateStr);

  const skip = () =>
    actions.handleCancel(entry, occurrenceDateStr);

  const postpone = (to: ChorePostponeTarget, customDate?: string) => {
    if (to === "tomorrow") {
      return actions.handlePostpone(entry, occurrenceDateStr, "tomorrow");
    }
    if (to === "end_of_week") {
      const eow = endOfWeek(new Date(), { weekStartsOn: 1 });
      return actions.handlePostpone(
        entry,
        occurrenceDateStr,
        "custom",
        undefined,
        format(eow, "yyyy-MM-dd") + "T12:00:00.000Z",
      );
    }
    if (to === "next_week") {
      const nw = addWeeks(new Date(), 1);
      return actions.handlePostpone(
        entry,
        occurrenceDateStr,
        "custom",
        undefined,
        nw.toISOString(),
      );
    }
    if (to === "custom" && customDate) {
      return actions.handlePostpone(
        entry,
        occurrenceDateStr,
        "custom",
        undefined,
        customDate,
      );
    }
  };

  const transferToPartner = () => {
    const partnerId = householdPartner?.partnerId;
    if (!partnerId) return;
    updateItem.mutate({ id: entry.id, responsible_user_id: partnerId });
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
    reopen,
    skip,
    postpone,
    transferToPartner,
    scheduleToday,
    hasPartner: !!householdPartner?.partnerId,
  };
}
