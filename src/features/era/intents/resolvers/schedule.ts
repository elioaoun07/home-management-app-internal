// Schedule resolver — fetches today's items + overdue via supabaseBrowser,
// and creates real reminders from natural language (draftReminder).
import { safeFetch } from "@/lib/safeFetch";
import { parseSmartText } from "@/lib/smartTextParser";
import { supabaseBrowser } from "@/lib/supabase/client";
import { localToISO } from "@/lib/utils/date";
import type { ItemPriority } from "@/types/items";
import type { EraPendingTurn } from "../../types";
import {
  formatAskReminderTime,
  formatReminderCreated,
  formatReminderError,
  formatReminderSavedAsDraft,
  formatScheduleError,
  formatTodaySchedule,
} from "../formatters/schedule";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
  pending?: EraPendingTurn | null;
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
 * the form agree on titles, dates and recurrence.
 *
 * **Time is a required slot (Slice 3).** `confidence.date === 0` means the
 * parser found no date at all. Earlier this resolver wrote the item anyway
 * with `due_at` omitted — technically honest (never invents a time) but the
 * owner's own complaint: ERA "logged the reminder without mentioning the
 * time" and moved on, leaving a silent, alert-less item. Now it asks instead
 * of writing, and returns a `pending` question `useEraTurn` holds until the
 * next turn answers it (see `resolvePendingReminderAnswer`) or it's flushed
 * to a draft.
 *
 * **Local → UTC via `localToISO`** once a date IS known. `dueDate`/`dueTime`
 * are wall-clock strings; `due_at` is `timestamptz`. Mirrors
 * MobileReminderForm, including its noon default when a date was parsed but
 * no time (Hard Rule #18).
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

  if (parsed.confidence.date === 0 || !parsed.dueDate) {
    return {
      text: formatAskReminderTime({ title: finalTitle }),
      pending: {
        kind: "draftReminder",
        title: finalTitle,
        priority: parsed.priority,
        rawText,
        createdAt: Date.now(),
      },
    };
  }

  return writeReminder(finalTitle, parsed.priority, parsed.dueDate, parsed.dueTime, parsed.recurrenceRule);
}

async function writeReminder(
  title: string,
  priority: ItemPriority,
  dueDate: string,
  dueTime: string | undefined,
  recurrenceRule: string | undefined,
): Promise<ResolveResult> {
  const dueAt = localToISO(dueDate, dueTime || "12:00");

  try {
    const res = await safeFetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reminder",
        title,
        priority,
        due_at: dueAt,
      }),
      timeoutMs: 8_000,
    });

    if (!res.ok) return { text: formatReminderError() };

    const { item } = (await res.json()) as { item?: { id?: string } };

    return {
      text: formatReminderCreated({
        title,
        dueAt,
        recurring: Boolean(recurrenceRule),
      }),
      metadata: {
        itemId: item?.id ?? null,
        title,
        dueAt,
        recurrenceRule: recurrenceRule ?? null,
        priority,
      },
      pending: null,
    };
  } catch {
    return { text: formatReminderError() };
  }
}

/**
 * Answers a pending "what time?" question (Slice 3). Called by `useEraTurn`
 * instead of the normal router whenever a `draftReminder` question is
 * outstanding — the whole next utterance is treated as the time answer, not
 * reclassified.
 *
 * If it parses to a date, the reminder is written for real (same path as a
 * one-shot "remind me… tomorrow at 5"). If it doesn't, the title is not
 * lost: it's flushed to a reviewable `items.status = 'draft'` row — the same
 * rule bulk-convert already uses for an unconfirmed item — rather than
 * silently discarded or, worse, misread as a fresh unrelated command.
 */
export async function resolvePendingReminderAnswer(
  pending: EraPendingTurn,
  answerText: string,
): Promise<ResolveResult> {
  const parsed = parseSmartText(answerText);

  if (parsed.confidence.date > 0 && parsed.dueDate) {
    return writeReminder(pending.title, pending.priority, parsed.dueDate, parsed.dueTime, parsed.recurrenceRule);
  }

  try {
    const res = await safeFetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reminder",
        title: pending.title,
        priority: pending.priority,
        status: "draft",
      }),
      timeoutMs: 8_000,
    });

    if (!res.ok) return { text: formatReminderError(), pending: null };

    const { item } = (await res.json()) as { item?: { id?: string } };

    return {
      text: formatReminderSavedAsDraft({ title: pending.title }),
      metadata: { itemId: item?.id ?? null, title: pending.title, draft: true },
      pending: null,
    };
  } catch {
    return { text: formatReminderError(), pending: null };
  }
}
