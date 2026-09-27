// Schedule resolver — fetches a day's items + overdue via the shared items
// bundle, and creates real reminders from natural language (draftReminder).
import { fetchAllOccurrenceActions, normalizeToLocalDateString } from "@/features/items/useItemActions";
import { fetchItems } from "@/features/items/useItems";
import { safeFetch } from "@/lib/safeFetch";
import { parseSmartText } from "@/lib/smartTextParser";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDate, localToISO } from "@/lib/utils/date";
import { expandOccurrencesInRange, getOccurrencesForDay } from "@/lib/utils/dayOccurrences";
import type { ItemPriority } from "@/types/items";
import type { EraActiveProposal, EraPendingReminder, EraPendingTurn } from "../../types";
import {
  formatAskReminderTime,
  formatFocusMissing,
  formatReminderActionError,
  formatReminderCompleted,
  formatReminderCreated,
  formatReminderDeleted,
  formatReminderError,
  formatReminderRescheduled,
  formatReminderSavedAsDraft,
  formatRecurringNeedsApp,
  formatScheduleError,
  formatScheduleForDay,
} from "../formatters/schedule";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
  pending?: EraPendingTurn | null;
  /** HUB-34 — false on every graceful-error return below; see resolveIntent.ts's ResolveResult doc for why this exists. */
  ok?: boolean;
}

/**
 * "What's on my schedule Saturday" — `dateISO` (yyyy-MM-dd) names the day
 * being asked about; omitted means today. Reuses `fetchItems` (the same
 * household-resolved `get_schedule_bundle` RPC bundle the day planner uses)
 * and `getOccurrencesForDay` (the day planner's own occurrence expansion),
 * so ERA and the Schedule module can never disagree about what's due on a
 * given day. Overdue is a "relative to now" concept and is only computed
 * when the target day is today.
 */
export async function resolveScheduleForDay(dateISO?: string): Promise<ResolveResult> {
  try {
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { text: formatScheduleError(), ok: false };

    const [items, actions] = await Promise.all([
      fetchItems(),
      fetchAllOccurrenceActions(),
    ]);

    // Noon anchor avoids the UTC-midnight-drift trap documented in HUB-20 —
    // a bare `new Date(dateISO)` parses as UTC midnight and can land on the
    // wrong local calendar day.
    const targetDate = dateISO ? new Date(`${dateISO}T12:00:00`) : new Date();
    const isToday = formatDate(targetDate) === formatDate(new Date());

    const activeItems = items.filter(
      (item) => item.status !== "completed" && item.status !== "cancelled",
    );

    const dayOccurrences = getOccurrencesForDay(activeItems, targetDate, actions, [])
      .filter((occ) => !occ.isCompleted)
      .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());

    const dayItems = dayOccurrences.map((occ) => ({
      title: occ.item.title,
      time: occ.occurrenceDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    }));

    let overdueCount = 0;
    let firstOverdueTitle: string | null = null;
    if (isToday) {
      const now = new Date().toISOString();
      const todayStartISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      for (const item of activeItems) {
        const alerts = item.alerts ?? [];
        for (const alert of alerts) {
          if (!alert.active || !alert.trigger_at) continue;
          if (alert.trigger_at < now && alert.trigger_at < todayStartISO) {
            overdueCount++;
            if (!firstOverdueTitle) firstOverdueTitle = item.title;
          }
          break; // one alert per item is enough for counting
        }
      }
    }

    return {
      text: formatScheduleForDay({
        dateISO: formatDate(targetDate),
        isToday,
        items: dayItems,
        overdueCount,
        firstOverdueTitle,
      }),
      metadata: {
        dateISO: formatDate(targetDate),
        count: dayItems.length,
        overdueCount,
      },
    };
  } catch {
    return { text: formatScheduleError(), ok: false };
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
    return { text: formatReminderError("no-title"), ok: false };
  }

  if (parsed.confidence.date === 0 || !parsed.dueDate) {
    // Nothing has been written yet — this only asks a follow-up question.
    // HUB-34: not a success to learn from (via reminder.create's Ask AI
    // wrapper); the reminder isn't created until the answer resolves it.
    return {
      text: formatAskReminderTime({ title: finalTitle }),
      pending: {
        kind: "draftReminder",
        title: finalTitle,
        priority: parsed.priority,
        rawText,
        createdAt: Date.now(),
      },
      ok: false,
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

    if (!res.ok) return { text: formatReminderError(), ok: false };

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
    return { text: formatReminderError(), ok: false };
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
  pending: EraPendingReminder,
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

// ---------------------------------------------------------------------------
// Stage 1 — focus-memory follow-ups: reschedule / complete / delete
// ---------------------------------------------------------------------------

/** Pull whichever shape a Supabase embed returned — object, array, or none. */
function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * "Change it to 11" / "Move that to tomorrow at 5". `itemId`/`title` were
 * already resolved from focus memory by the router; `null` means no live
 * focus entity existed, so there's nothing to reschedule.
 *
 * A bare time ("11") has no date component — `parseSmartText` needs an "at"
 * or "on" to find a time at all (see the "at " prefix below), and even then
 * gives no date. Rather than defaulting to today (which could silently move
 * a reminder backwards if it was due tomorrow), the reminder's OWN existing
 * date is kept and only the time shifts — "change it to 11" means "same day,
 * new time", not "today at 11".
 */
/**
 * Free-text new day/time → ISO. A bare time keeps the reference's date.
 * "at " lets a bare time ("11", "10 AM") hit parseTime's `at N` pattern;
 * parseRelativeDate finds date words anywhere in the string regardless.
 * parseSmartText's type detector can read whenText as an event noun (e.g.
 * "appointment") and route the parse into start/end fields instead of due.
 */
export function whenToISO(whenText: string, referenceISO: string | null): string | null {
  const parsed = parseSmartText(`at ${whenText}`);
  const parsedDate = parsed.dueDate ?? parsed.startDate;
  const parsedTime = parsed.dueTime ?? parsed.startTime;
  if (parsed.confidence.date > 0 && parsedDate) return localToISO(parsedDate, parsedTime || "12:00");
  if (parsed.confidence.time > 0 && parsedTime && referenceISO) {
    return localToISO(formatDate(new Date(referenceISO)), parsedTime);
  }
  return null;
}

/**
 * HUB-78 — "this one" for a recurring reminder: postpone the NEXT open
 * occurrence through the same occurrence-action route the app uses
 * (`POST /api/items/[id]/actions`, action "postpone"), which writes an
 * occurrence exception and never touches the rule (recurrence-safety).
 * The occurrence comes from `expandOccurrencesInRange` — the existing
 * expansion engine, not a new one. Runs only from a confirm card.
 */
/** HUB-79 — skip the next open occurrence; same route and engine as postpone. */
export async function skipNextOccurrence(
  itemId: string,
  title: string,
): Promise<ResolveResult & { outcome: "done" | "failed" | "uncertain" }> {
  try {
    const [items, actions] = await Promise.all([
      fetchItems({ type: "reminder" }),
      fetchAllOccurrenceActions(),
    ]);
    const item = items.find((i) => i.id === itemId);
    if (!item?.recurrence_rule?.rrule) return { text: `${title} doesn't repeat.`, ok: false, outcome: "failed" };
    const now = new Date();
    const horizon = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    const next = expandOccurrencesInRange([item], now, horizon, actions).find((o) => !o.isCompleted);
    if (!next) return { text: `Nothing coming up for ${title}.`, ok: false, outcome: "failed" };
    const occurrence = normalizeToLocalDateString(next.occurrenceDate);
    const res = await safeFetch(`/api/items/${itemId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", occurrence_date: occurrence, is_recurring: true }),
      timeoutMs: 8_000,
    });
    if (!res.ok) return { text: `Couldn't skip ${title}.`, ok: false, outcome: "failed" };
    return { text: `Skipped · ${title} · ${occurrence}`, metadata: { itemId, title, occurrence }, outcome: "done" };
  } catch {
    return { text: `Not sure ${title} was skipped.`, ok: false, outcome: "uncertain" };
  }
}

export async function postponeNextOccurrence(
  itemId: string,
  title: string,
  whenText: string,
): Promise<ResolveResult & { outcome: "done" | "failed" | "uncertain" }> {
  try {
    const [items, actions] = await Promise.all([
      fetchItems({ type: "reminder" }),
      fetchAllOccurrenceActions(),
    ]);
    const item = items.find((i) => i.id === itemId);
    if (!item) return { text: formatReminderActionError(title, "reschedule"), ok: false, outcome: "failed" };
    const now = new Date();
    const horizon = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    const next = expandOccurrencesInRange([item], now, horizon, actions).find((o) => !o.isCompleted);
    if (!next) return { text: formatReminderActionError(title, "reschedule"), ok: false, outcome: "failed" };
    const postponedTo = whenToISO(whenText, next.occurrenceDate.toISOString());
    if (!postponedTo) return { text: formatReminderActionError(title, "reschedule"), ok: false, outcome: "failed" };

    const res = await safeFetch(`/api/items/${itemId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "postpone",
        occurrence_date: normalizeToLocalDateString(next.occurrenceDate),
        is_recurring: true,
        postponed_to: postponedTo,
        postpone_type: "custom",
      }),
      timeoutMs: 8_000,
    });
    if (!res.ok) return { text: formatReminderActionError(title, "reschedule"), ok: false, outcome: "failed" };
    return {
      text: formatReminderRescheduled({ title, dueAt: postponedTo }),
      metadata: { itemId, title, dueAt: postponedTo, occurrence: normalizeToLocalDateString(next.occurrenceDate) },
      outcome: "done",
    };
  } catch {
    return { text: formatReminderActionError(title, "reschedule"), ok: false, outcome: "uncertain" };
  }
}

export async function resolveReminderReschedule(
  itemId: string | null,
  title: string | null,
  whenText: string,
): Promise<ResolveResult> {
  if (!itemId) return { text: formatFocusMissing("reschedule"), ok: false };

  let existingDueAt: string | null = null;
  try {
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from("reminder_details")
      .select("due_at")
      .eq("item_id", itemId)
      .maybeSingle();
    existingDueAt = data?.due_at ?? null;
  } catch {
    // Non-fatal — a full date in whenText still resolves without this.
  }

  const dueAt = whenToISO(whenText, existingDueAt);
  if (!dueAt) return { text: formatReminderActionError(title, "reschedule"), ok: false };

  try {
    const res = await safeFetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_at: dueAt }),
      timeoutMs: 8_000,
    });
    if (!res.ok) return { text: formatReminderActionError(title, "reschedule"), ok: false };

    return {
      text: formatReminderRescheduled({ title: title ?? "that reminder", dueAt }),
      // HUB-78 — previousDueAt is the demonstrated inverse (Undo re-PATCHes it).
      metadata: { itemId, title, dueAt, previousDueAt: existingDueAt },
    };
  } catch {
    return { text: formatReminderActionError(title, "reschedule"), ok: false };
  }
}

/**
 * "Mark it done" / "complete that". Restricted to NON-recurring reminders —
 * completing a specific occurrence of a recurring item needs to know WHICH
 * occurrence, and a chat pronoun gives no way to disambiguate that safely
 * (recurrence-safety territory); those get pointed at the app instead of a
 * guessed occurrence date.
 */
export async function resolveReminderComplete(
  itemId: string | null,
  title: string | null,
): Promise<ResolveResult> {
  if (!itemId) return { text: formatFocusMissing("complete"), ok: false };

  try {
    const supabase = supabaseBrowser();
    const { data: item } = await supabase
      .from("items")
      .select("id, reminder_details(due_at), item_recurrence_rules(id)")
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return { text: formatReminderActionError(title, "complete"), ok: false };

    const rules = embedOne((item as any).item_recurrence_rules);
    if (rules) return { text: formatRecurringNeedsApp(title, "complete"), ok: false };

    const reminderDetails = embedOne<{ due_at: string | null }>(
      (item as any).reminder_details,
    );
    const occurrenceDate = reminderDetails?.due_at
      ? formatDate(new Date(reminderDetails.due_at))
      : formatDate(new Date());

    const res = await safeFetch(`/api/items/${itemId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occurrence_date: occurrenceDate, is_recurring: false }),
      timeoutMs: 8_000,
    });
    if (!res.ok) return { text: formatReminderActionError(title, "complete"), ok: false };

    return {
      text: formatReminderCompleted(title),
      metadata: { itemId, title },
    };
  } catch {
    return { text: formatReminderActionError(title, "complete"), ok: false };
  }
}

/**
 * HUB-76 — "delete it" / "cancel that" never deletes on the spot: it returns
 * a confirm card (Plan §5: deletes confirm). The card executes the registry's
 * `reminder.delete` capability (→ `resolveReminderDelete`) on tap.
 */
export function prepareReminderDelete(
  itemId: string | null,
  title: string | null,
  rawText = "",
  capabilityId = "reminder.delete",
): ResolveResult & { proposal?: EraActiveProposal } {
  if (!itemId) return { text: formatFocusMissing("delete"), ok: false };
  const text = `Delete · ${title ?? "reminder"}`;
  return {
    text,
    metadata: { proposed: "reminderDelete", title },
    proposal: {
      kind: "native_action",
      text,
      sourceText: rawText,
      action: { type: "capability", capabilityId, slots: { itemId, ...(title ? { title } : {}) } },
    },
  };
}

/**
 * "Delete it" / "cancel that". Soft-deletes to the Recycle Bin (same as the
 * app's own delete button) — recoverable for 30 days, not a hard delete.
 * Deliberately omits `itemId` from the returned metadata: a deleted item
 * should fall out of focus, not get pushed back in.
 */
export async function resolveReminderDelete(
  itemId: string | null,
  title: string | null,
): Promise<ResolveResult> {
  if (!itemId) return { text: formatFocusMissing("delete"), ok: false };

  try {
    const res = await safeFetch(`/api/items/${itemId}`, {
      method: "DELETE",
      timeoutMs: 8_000,
    });
    if (!res.ok) return { text: formatReminderActionError(title, "delete"), ok: false };

    return {
      text: formatReminderDeleted(title),
      metadata: { deletedItemId: itemId, title },
    };
  } catch {
    return { text: formatReminderActionError(title, "delete"), ok: false };
  }
}
