"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { CACHE_TIMES } from "@/lib/queryConfig";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface ScheduleSummary {
  todayCount: number;
  overdueCount: number;
  firstTitle: string | null;
}

async function fetchScheduleSummary(): Promise<ScheduleSummary> {
  const supabase = supabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { todayCount: 0, overdueCount: 0, firstTitle: null };

  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  const partnerId = link
    ? link.owner_user_id === user.id ? link.partner_user_id : link.owner_user_id
    : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const nowISO = new Date().toISOString();
  const todayStartISO = todayStart.toISOString();
  const todayEndISO = todayEnd.toISOString();

  let q = supabase
    .from("items")
    .select("id, title, item_alerts(trigger_at, active)")
    .not("status", "in", `("completed","cancelled","dormant")`)
    .limit(200);

  if (partnerId) {
    q = q.in("responsible_user_id", [user.id, partnerId]);
  } else {
    q = q.eq("responsible_user_id", user.id);
  }

  const { data: items } = await q;

  let todayCount = 0;
  let overdueCount = 0;
  let firstTitle: string | null = null;

  for (const item of items ?? []) {
    const alerts = (item as any).item_alerts as Array<{ trigger_at: string | null; active: boolean }> | null;
    if (!alerts?.length) continue;
    for (const alert of alerts) {
      if (!alert.active || !alert.trigger_at) continue;
      const at = alert.trigger_at;
      if (at >= todayStartISO && at <= todayEndISO) {
        todayCount++;
        if (!firstTitle) firstTitle = item.title;
      } else if (at < nowISO && at < todayStartISO) {
        overdueCount++;
      }
      break;
    }
  }

  return { todayCount, overdueCount, firstTitle };
}

export function useScheduleSummary() {
  return useQuery({
    queryKey: eraKeys.widgets.schedule(),
    queryFn: fetchScheduleSummary,
    staleTime: CACHE_TIMES.TRANSACTIONS,
  });
}
