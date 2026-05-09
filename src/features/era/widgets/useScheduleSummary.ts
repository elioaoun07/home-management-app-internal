"use client";

import {
  bucketSchedule,
  getEffectiveSchedule,
  type ScheduleSourceRow,
} from "@/lib/items/scheduleTime";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface ScheduleNextItem {
  id: string;
  title: string;
  scheduledAt: string;
  source: "event" | "reminder" | "alert";
}

export interface ScheduleSummary {
  todayCount: number;
  overdueCount: number;
  tomorrowCount: number;
  thisWeekCount: number;
  completedTodayCount: number;
  /** Active items with no due date / event / alert — visible in /reminders but unscheduled. */
  unscheduledCount: number;
  firstTitle: string | null;
  /** Next 3 upcoming (today + later within the week), earliest first. */
  nextThree: ScheduleNextItem[];
}

interface ItemRow {
  id: string;
  title: string;
  status: string;
  reminder_details:
    | { due_at: string | null; completed_at: string | null }
    | Array<{ due_at: string | null; completed_at: string | null }>
    | null;
  event_details:
    | {
        start_at: string | null;
        end_at: string | null;
        all_day: boolean | null;
      }
    | Array<{
        start_at: string | null;
        end_at: string | null;
        all_day: boolean | null;
      }>
    | null;
  item_alerts: Array<{ trigger_at: string | null; active: boolean }> | null;
}

const SELECT = `
  id,
  title,
  status,
  reminder_details (*),
  event_details (*),
  item_alerts (*)
`;

async function fetchScheduleSummary(): Promise<ScheduleSummary> {
  const empty: ScheduleSummary = {
    todayCount: 0,
    overdueCount: 0,
    tomorrowCount: 0,
    thisWeekCount: 0,
    completedTodayCount: 0,
    unscheduledCount: 0,
    firstTitle: null,
    nextThree: [],
  };

  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

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

  let q = supabase
    .from("items")
    .select(SELECT)
    .is("archived_at", null)
    .not("status", "in", `("completed","cancelled")`)
    .limit(300);

  q = partnerId
    ? q.or(`user_id.eq.${user.id},user_id.eq.${partnerId}`)
    : q.eq("user_id", user.id);

  const { data: rows } = await q;
  if (!rows) return empty;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  let todayCount = 0;
  let overdueCount = 0;
  let tomorrowCount = 0;
  let thisWeekCount = 0;
  let completedTodayCount = 0;
  let unscheduledCount = 0;
  let firstTitle: string | null = null;
  const upcoming: ScheduleNextItem[] = [];

  for (const row of rows as unknown as ItemRow[]) {
    const sched = getEffectiveSchedule(row as ScheduleSourceRow);

    const reminder = Array.isArray(row.reminder_details)
      ? row.reminder_details[0]
      : row.reminder_details;
    if (reminder?.completed_at) {
      const at = new Date(reminder.completed_at);
      if (at >= todayStart && at <= todayEnd) completedTodayCount++;
      continue;
    }

    if (!sched.scheduledAt) {
      unscheduledCount++;
      continue;
    }

    const bucket = bucketSchedule(sched.scheduledAt, now);
    if (bucket === "overdue") overdueCount++;
    else if (bucket === "today") {
      todayCount++;
      if (!firstTitle) firstTitle = row.title;
    } else if (bucket === "tomorrow") tomorrowCount++;
    else if (bucket === "thisWeek") thisWeekCount++;

    if (bucket === "today" || bucket === "tomorrow" || bucket === "thisWeek") {
      upcoming.push({
        id: row.id,
        title: row.title,
        scheduledAt: sched.scheduledAt,
        source: sched.source === "none" ? "alert" : sched.source,
      });
    }
  }

  upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return {
    todayCount,
    overdueCount,
    tomorrowCount,
    thisWeekCount,
    completedTodayCount,
    unscheduledCount,
    firstTitle,
    nextThree: upcoming.slice(0, 3),
  };
}

export function useScheduleSummary() {
  return useQuery({
    queryKey: eraKeys.widgets.schedule(),
    queryFn: fetchScheduleSummary,
    staleTime: CACHE_TIMES.TRANSACTIONS,
  });
}
