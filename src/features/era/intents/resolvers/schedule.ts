// Schedule resolver — fetches today's items + overdue via supabaseBrowser,
// and creates real reminders from natural language (draftReminder).
import { safeFetch } from "@/lib/safeFetch";
import { parseSmartText } from "@/lib/smartTextParser";
import { supabaseBrowser } from "@/lib/supabase/client";
import { localToISO } from "@/lib/utils/date";
import {
  formatReminderCreated,
  formatReminderError,
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

// ---------------------------------------------------------------------------
// draftReminder — natural language → a real reminder item
// ---------------------------------------------------------------------------

/**
 * Create a reminder from an utterance like "remind me to call the bank
 * tomorrow at 5pm".
 *
 * `parseSmartText` is the same NLP the mobile reminder form uses, so ERA and
 * the form agree on titles, dates and recurrence. Two rules matter here:
 *
 *  - **Never send a `due_at` we invented.** `confidence.date === 0` means the
 *    parser found no date at all; sending "now" would fire an alert instantly.
 *    We omit `due_at` and the item lands undated, exactly like a form submit
 *    with the date field left blank.
 *  - **Local → UTC via `localToISO`.** `dueDate`/`dueTime` are wall-clock
 *    strings; `due_at` is `timestamptz`. Mirrors MobileReminderForm, including
 *    its noon default when a date was parsed but no time (Hard Rule #18).
 *
 * `title` is the already-cleaned title from the router; we re-derive from the
 * raw text only as a fallback so this resolver is safe to call directly.
 */
export async function resolveDraftReminder(
  rawText: string,
  title?: string,
): Promise<ResolveResult> {
  const parsed = parseSmartText(rawText);

  const finalTitle = (title?.trim() || parsed.title?.trim() || "").trim();
  if (!finalTitle) {
    return { text: formatReminderError("no-title") };
  }

  // Only send a due_at the user actually expressed (see doc comment).
  let dueAt: string | null = null;
  if (parsed.confidence.date > 0 && parsed.dueDate) {
    dueAt = localToISO(parsed.dueDate, parsed.dueTime || "12:00");
  }

  try {
    const res = await safeFetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reminder",
        title: finalTitle,
        priority: parsed.priority,
        ...(dueAt ? { due_at: dueAt } : {}),
      }),
      timeoutMs: 8_000,
    });

    if (!res.ok) return { text: formatReminderError() };

    const { item } = (await res.json()) as { item?: { id?: string } };

    return {
      text: formatReminderCreated({
        title: finalTitle,
        dueAt,
        recurring: Boolean(parsed.recurrenceRule),
      }),
      metadata: {
        itemId: item?.id ?? null,
        title: finalTitle,
        dueAt,
        recurrenceRule: parsed.recurrenceRule ?? null,
        priority: parsed.priority,
      },
    };
  } catch {
    return { text: formatReminderError() };
  }
}
