// src/lib/gcal/sync.ts
// One-way (app -> Google) calendar backup sync for scheduled items
// (Reminders/Events with a due/start time — never system alerts). The app
// is always the source; Google is never read back (see registry.tsx's
// NotificationClass taxonomy and the M1 scope fence in ERA Notes).
//
// Mirrors the src/lib/pushSender.ts pattern: functions accept the caller's
// Supabase client (user-context or supabaseAdmin) — but ONLY as the access
// gate (the initial item fetch). Everything after the gate runs on
// supabaseAdmin(): google_calendar_connections has no user UPDATE policy
// (bookkeeping writes would silently no-op under RLS), the connection row
// may belong to the *responsible* user (partner) rather than the caller,
// and the items bookkeeping columns must update even on partner-owned items.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildFullRRuleString } from "@/lib/utils/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { calendar_v3 } from "googleapis";
import { getCalendarClientForUser, isGoogleNotFoundError } from "./client";

interface ReminderDetails {
  due_at: string | null;
}
interface EventDetails {
  start_at: string;
  end_at: string;
  all_day: boolean;
}
interface RecurrenceRule {
  rrule: string;
  start_anchor: string;
  end_until: string | null;
  count: number | null;
}
interface ItemAlert {
  kind: string;
  offset_minutes: number | null;
  trigger_at: string | null;
  active: boolean;
}

interface SyncableItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string | null;
  user_id: string;
  responsible_user_id: string;
  google_event_id: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  reminder_details: ReminderDetails | ReminderDetails[] | null;
  event_details: EventDetails | EventDetails[] | null;
  item_recurrence_rules: RecurrenceRule[] | null;
  item_alerts: ItemAlert[] | null;
}

const ITEM_SELECT = `
  id, type, title, description, status, user_id, responsible_user_id,
  google_event_id, archived_at, deleted_at,
  reminder_details(due_at),
  event_details(start_at, end_at, all_day),
  item_recurrence_rules(rrule, start_anchor, end_until, count),
  item_alerts(kind, offset_minutes, trigger_at, active)
`;

// 1:1 child tables (item_id is the PK) come back as an object from
// PostgREST, but defend against the array shape too — the relationship
// inference depends on the FK metadata Supabase introspects.
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function fetchSyncableItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<SyncableItem | null> {
  const { data } = await supabase
    .from("items")
    .select(ITEM_SELECT)
    .eq("id", itemId)
    .maybeSingle();
  return (data as unknown as SyncableItem) ?? null;
}

function isSyncEligible(item: SyncableItem): boolean {
  if (item.archived_at || item.deleted_at) return false;
  if (item.status === "completed" || item.status === "cancelled") return false;
  if (item.type !== "reminder" && item.type !== "event") return false;
  const due = firstOf(item.reminder_details)?.due_at;
  const start = firstOf(item.event_details)?.start_at;
  return Boolean(due || start);
}

function buildEventBody(item: SyncableItem): calendar_v3.Schema$Event {
  const reminderDetails = firstOf(item.reminder_details);
  const eventDetails = firstOf(item.event_details);
  const isEvent = item.type === "event" && eventDetails;

  const startISO = isEvent ? eventDetails.start_at : reminderDetails!.due_at!;
  const endISO = isEvent
    ? eventDetails.end_at
    : new Date(new Date(startISO).getTime() + 15 * 60 * 1000).toISOString();

  const rule = item.item_recurrence_rules?.[0];
  const recurrence = rule
    ? [
        buildFullRRuleString(new Date(rule.start_anchor || startISO), {
          rrule: rule.rrule,
          count: rule.count,
          end_until: rule.end_until,
        }),
      ]
    : undefined;

  const overrides = (item.item_alerts || [])
    .filter((a) => a.active !== false)
    .map((a): calendar_v3.Schema$EventReminder | null => {
      if (a.kind === "relative" && a.offset_minutes != null) {
        return { method: "popup", minutes: a.offset_minutes };
      }
      if (a.trigger_at) {
        const diffMinutes = Math.round(
          (new Date(startISO).getTime() - new Date(a.trigger_at).getTime()) / 60000,
        );
        return { method: "popup", minutes: Math.max(0, diffMinutes) };
      }
      return null;
    })
    .filter((o): o is calendar_v3.Schema$EventReminder => o !== null)
    .slice(0, 5); // Google caps reminder overrides at 5 per event

  const allDay = isEvent && eventDetails.all_day;

  return {
    summary: item.title,
    description: item.description || undefined,
    start: allDay ? { date: startISO.slice(0, 10) } : { dateTime: startISO },
    end: allDay ? { date: endISO.slice(0, 10) } : { dateTime: endISO },
    recurrence,
    reminders: { useDefault: false, overrides },
  };
}

/**
 * Push the current state of an item to Google Calendar (insert if never
 * synced, patch if it has a google_event_id). No-ops silently if the
 * responsible user hasn't connected Google Calendar or has sync disabled —
 * this is an optional backup channel, never a hard dependency.
 *
 * Call this after any item mutation that could affect a synced event
 * (create, update due/start time or title, complete, un-complete). Errors
 * are caught and recorded on the connection row — they never propagate to
 * the caller, since calendar sync must never block the primary mutation.
 */
export async function syncItemToGoogleCalendar(
  supabase: SupabaseClient,
  itemId: string,
): Promise<void> {
  try {
    // Access gate: fetched with the caller's client — if the caller can't
    // read the item under RLS, this returns null and the sync no-ops.
    const item = await fetchSyncableItem(supabase, itemId);
    if (!item) return;

    const admin = supabaseAdmin();
    const userId = item.responsible_user_id || item.user_id;
    const { data: connection } = await admin
      .from("google_calendar_connections")
      .select("refresh_token, google_calendar_id, sync_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (!connection?.sync_enabled) return;

    if (!isSyncEligible(item)) {
      if (item.google_event_id) await deleteItemFromGoogleCalendar(supabase, itemId);
      return;
    }

    const calendar = getCalendarClientForUser(connection.refresh_token);
    const eventBody = buildEventBody(item);

    try {
      if (item.google_event_id) {
        await calendar.events.patch({
          calendarId: connection.google_calendar_id,
          eventId: item.google_event_id,
          requestBody: eventBody,
        });
        await admin
          .from("items")
          .update({ google_synced_at: new Date().toISOString() })
          .eq("id", itemId);
      } else {
        const created = await calendar.events.insert({
          calendarId: connection.google_calendar_id,
          requestBody: eventBody,
        });
        await admin
          .from("items")
          .update({
            google_event_id: created.data.id,
            google_synced_at: new Date().toISOString(),
          })
          .eq("id", itemId);
      }
      await admin
        .from("google_calendar_connections")
        .update({ last_synced_at: new Date().toISOString(), sync_error: null })
        .eq("user_id", userId);
    } catch (err) {
      // The event was deleted directly in Google — clear our stale
      // reference and retry once as a fresh insert.
      if (item.google_event_id && isGoogleNotFoundError(err)) {
        await admin.from("items").update({ google_event_id: null }).eq("id", itemId);
        await syncItemToGoogleCalendar(supabase, itemId);
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      await admin
        .from("google_calendar_connections")
        .update({ sync_error: message })
        .eq("user_id", userId);
    }
  } catch {
    // Calendar sync is a best-effort backup channel — never throw into the
    // caller's mutation flow.
  }
}

/** Remove an item's Google Calendar event (item deleted, or no longer sync-eligible). */
export async function deleteItemFromGoogleCalendar(
  supabase: SupabaseClient,
  itemId: string,
): Promise<void> {
  try {
    // Access gate: caller's client — no read access under RLS means no-op.
    const { data: item } = await supabase
      .from("items")
      .select("id, google_event_id, user_id, responsible_user_id")
      .eq("id", itemId)
      .maybeSingle();
    if (!item?.google_event_id) return;

    const admin = supabaseAdmin();
    const userId = item.responsible_user_id || item.user_id;
    const { data: connection } = await admin
      .from("google_calendar_connections")
      .select("refresh_token, google_calendar_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (connection) {
      const calendar = getCalendarClientForUser(connection.refresh_token);
      try {
        await calendar.events.delete({
          calendarId: connection.google_calendar_id,
          eventId: item.google_event_id,
        });
      } catch {
        // Already gone on Google's side — fine, clear our reference regardless.
      }
    }

    await admin
      .from("items")
      .update({ google_event_id: null, google_synced_at: null })
      .eq("id", itemId);
  } catch {
    // Best-effort — never throw into the caller's mutation flow.
  }
}
