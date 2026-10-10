"use client";

import { useAllOccurrenceActions } from "@/features/items/useItemActions";
import {
  useFlexibleRoutines,
  useFlexibleSchedules,
} from "@/features/items/useFlexibleRoutines";
import { useItems } from "@/features/items/useItems";
import type { CatalogueItem, HomeRoom } from "@/types/catalogue";
import type { ItemWithDetails } from "@/types/items";
import { addWeeks } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  buildChoreWeek,
  getWeekBounds,
  toDateKey,
  type ChoreSlot,
} from "./choreWeek";

const EMPTY_ITEMS: ItemWithDetails[] = [];

/** "Now" that refreshes when the app comes back to the foreground (PWA left open overnight). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return now;
}

/**
 * Chore week for the Chores page. `templates` and `rooms` come from the caller
 * (the Catalogue hooks live in another standalone module).
 */
export function useChoreWeek(
  weekOf: Date,
  templates: CatalogueItem[],
  rooms: HomeRoom[],
) {
  const now = useNow();
  const itemsQuery = useItems();
  const items = itemsQuery.data ?? EMPTY_ITEMS;
  const actionsQuery = useAllOccurrenceActions();
  const actions = actionsQuery.data;
  const { data: schedules } = useFlexibleSchedules();

  const flexibleChores = useMemo(
    () =>
      items.filter((item) => item.is_chore && item.recurrence_rule?.is_flexible),
    [items],
  );

  const { start: weekStart, end: weekEnd } = getWeekBounds(weekOf);
  const { start: prevStart, end: prevEnd } = getWeekBounds(addWeeks(now, -1));

  // A Mon–Sun week touches at most two periods (a month boundary); anchor both ends.
  const { data: weekA } = useFlexibleRoutines(flexibleChores, actions, weekStart);
  const { data: weekB } = useFlexibleRoutines(flexibleChores, actions, weekEnd);
  const { data: prevA } = useFlexibleRoutines(flexibleChores, actions, prevStart);
  const { data: prevB } = useFlexibleRoutines(flexibleChores, actions, prevEnd);

  const weekKey = toDateKey(weekStart);
  const prevKey = toDateKey(prevStart);
  const todayKey = toDateKey(now);

  const week = useMemo(
    () =>
      buildChoreWeek({
        weekOf: new Date(`${weekKey}T00:00:00`),
        now,
        items,
        actions: actions ?? [],
        schedules: schedules ?? [],
        flexible: [weekA, weekB],
        templates,
        rooms,
      }),
    [weekKey, now, items, actions, schedules, weekA, weekB, templates, rooms],
  );

  const previous = useMemo(
    () =>
      buildChoreWeek({
        weekOf: new Date(`${prevKey}T00:00:00`),
        now,
        items,
        actions: actions ?? [],
        schedules: schedules ?? [],
        flexible: [prevA, prevB],
        templates: [],
      }),
    [prevKey, now, items, actions, schedules, prevA, prevB],
  );

  const isCurrentWeek = todayKey >= week.weekStart && todayKey <= week.weekEnd;

  // Last week's unresolved flexible / one-off slots → Sunday check-in
  const checkIn: ChoreSlot[] = useMemo(
    () =>
      isCurrentWeek
        ? previous.slots.filter((s) => !s.done && s.kind !== "recurring")
        : [],
    [isCurrentWeek, previous.slots],
  );

  // One-offs overdue from before last week (last week's are in the check-in)
  const overdue: ChoreSlot[] = useMemo(
    () =>
      isCurrentWeek ? week.overdue.filter((s) => s.date < previous.weekStart) : [],
    [isCurrentWeek, week.overdue, previous.weekStart],
  );

  return {
    week,
    checkIn,
    overdue,
    todayKey,
    isCurrentWeek,
    schedules: schedules ?? [],
    isLoading: itemsQuery.isLoading || actionsQuery.isLoading,
    isError: itemsQuery.isError || actionsQuery.isError,
    refetch: () => {
      itemsQuery.refetch();
      actionsQuery.refetch();
    },
  };
}
