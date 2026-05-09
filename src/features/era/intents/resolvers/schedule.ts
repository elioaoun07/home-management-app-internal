// Schedule resolver — fetches today's items + overdue via supabaseBrowser
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  formatScheduleError,
  formatTodaySchedule,
} from "../formatters/schedule";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export async function resolveTodaySchedule(): Promise<ResolveResult> {
  try {
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { text: formatScheduleError() };

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
    const now = new Date().toISOString();
    const todayStartISO = todayStart.toISOString();
    const todayEndISO = todayEnd.toISOString();

    // Fetch active items for user + partner
    let q = supabase
      .from("items")
      .select(`
        id, title, status,
        alerts:item_alerts(trigger_at, active)
      `)
      .not("status", "in", `("completed","cancelled")`)
      .limit(200);

    if (partnerId) {
      q = q.or(`user_id.eq.${user.id},user_id.eq.${partnerId}`);
    } else {
      q = q.eq("user_id", user.id);
    }

    const { data: items } = await q;
    if (!items) return { text: formatScheduleError() };

    let todayCount = 0;
    let overdueCount = 0;
    let firstTitle: string | null = null;
    let firstOverdueTitle: string | null = null;

    for (const item of items) {
      const alerts = (item as any).alerts as Array<{ trigger_at: string | null; active: boolean }> | null;
      if (!alerts?.length) continue;

      for (const alert of alerts) {
        if (!alert.active || !alert.trigger_at) continue;
        const at = alert.trigger_at;

        if (at >= todayStartISO && at <= todayEndISO) {
          todayCount++;
          if (!firstTitle) firstTitle = item.title;
        } else if (at < now && at < todayStartISO) {
          overdueCount++;
          if (!firstOverdueTitle) firstOverdueTitle = item.title;
        }
        break; // one alert per item is enough for counting
      }
    }

    return {
      text: formatTodaySchedule({ todayCount, overdueCount, firstTitle, firstOverdueTitle }),
      metadata: { todayCount, overdueCount },
    };
  } catch {
    return { text: formatScheduleError() };
  }
}
