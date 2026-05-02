/**
 * Daily Items Reminder - Cron Endpoint
 *
 * Sends two daily summaries for items (tasks, reminders, events):
 * - Morning slot: summarizes items due today (skipped if none)
 * - Evening slot: summarizes overdue items (skipped if none)
 *
 * Uses the same preferred_times / last_sent_slots deduplication pattern
 * as the daily-transaction-reminder cron.
 *
 * Example metadata:
 * {
 *   "preferred_times": ["07:00:00", "18:00:00"],
 *   "last_sent_slots": { "2026-03-25": ["07:00:00"] }
 * }
 *
 * Cron schedule: every 5 minutes
 * Endpoint: GET /api/cron/daily-items-reminder
 */

import { sendPushToUser } from "@/lib/pushSender";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

function isTimeMatch(
  currentTotalMinutes: number,
  targetHour: number,
  targetMinute: number,
): boolean {
  const targetTotalMinutes = targetHour * 60 + targetMinute;
  const diff = currentTotalMinutes - targetTotalMinutes;
  const isMatch = diff >= 0 && diff < 5;
  const diffWrapped = currentTotalMinutes + 1440 - targetTotalMinutes;
  const isMatchWrapped =
    diffWrapped >= 0 && diffWrapped < 5 && targetTotalMinutes > 1435;
  return isMatch || isMatchWrapped;
}

function parseTime(timeStr: string): [number, number] {
  const [hour, minute] = timeStr.split(":").map(Number);
  return [hour, minute];
}

// Safely parse the metadata jsonb column. Never throws.
function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function buildItemsSummaryMessage(titles: string[], total: number): string {
  const preview = titles
    .slice(0, 3)
    .map((t) => `• ${t}`)
    .join("\n");
  const remaining = total - 3;
  return remaining > 0 ? `${preview}\nand ${remaining} more` : preview;
}

/**
 * Convert current UTC time to user's local timezone.
 * Returns local totalMinutes and local date string (YYYY-MM-DD).
 */
function getLocalTime(timezone: string): {
  totalMinutes: number;
  dateStr: string;
} {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value || "0";
    const hour = parseInt(get("hour"));
    const minute = parseInt(get("minute"));

    return {
      totalMinutes: hour * 60 + minute,
      dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    };
  } catch {
    // Invalid timezone — fall back to UTC
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    return {
      totalMinutes: h * 60 + m,
      dateStr: now.toISOString().split("T")[0],
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log("[Daily Items Reminder] Starting execution");

    // Verify cron secret (required — never skip)
    const authHeader = req.headers.get("authorization");
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    const now = new Date();
    const todayUTC = now.toISOString().split("T")[0];
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    console.log(
      `[Daily Items Reminder] Running at ${currentHour}:${String(currentMinute).padStart(2, "0")} UTC`,
    );

    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("id, user_id, timezone, metadata, last_sent_at")
      .eq("preference_key", "daily_items_reminder")
      .eq("enabled", true);

    if (prefError) {
      console.error(
        "[Daily Items Reminder] Error fetching preferences:",
        prefError,
      );
      return NextResponse.json({ error: prefError.message }, { status: 500 });
    }

    if (!preferences || preferences.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users with daily items reminder enabled",
        checked_at_utc: `${currentHour}:${currentMinute}`,
      });
    }

    const eligibleUsers: Array<{
      pref: (typeof preferences)[0];
      matchedSlot: string;
      localDateStr: string;
    }> = [];
    let alreadySentForSlot = 0;

    for (const pref of preferences) {
      const metadata = parseMetadata(pref.metadata);

      // preferred_times are stored in the user's LOCAL timezone
      const preferredTimesRaw = metadata.preferred_times;
      const preferredTimes: string[] = Array.isArray(preferredTimesRaw)
        ? preferredTimesRaw.filter(
            (t): t is string =>
              typeof t === "string" && /^\d{1,2}:\d{2}/.test(t),
          )
        : ["07:00:00", "18:00:00"];

      if (preferredTimes.length === 0) continue;

      const lastSentSlotsRaw = metadata.last_sent_slots;
      const lastSentSlots: Record<string, string[]> =
        lastSentSlotsRaw && typeof lastSentSlotsRaw === "object"
          ? (lastSentSlotsRaw as Record<string, string[]>)
          : {};

      // Convert current UTC time → user's local time for comparison
      const userTz = pref.timezone || "UTC";
      const { totalMinutes: localMinutes, dateStr: localDateStr } =
        getLocalTime(userTz);
      const todaySentSlots: string[] = lastSentSlots[localDateStr] || [];

      console.log(
        `[Daily Items Reminder] User ${pref.user_id.substring(0, 8)}: tz=${userTz}, localTime=${Math.floor(localMinutes / 60)}:${String(localMinutes % 60).padStart(2, "0")}, localDate=${localDateStr}, preferredTimes=${JSON.stringify(preferredTimes)}`,
      );

      for (const timeSlot of preferredTimes) {
        const [prefHour, prefMinute] = parseTime(timeSlot);
        if (isTimeMatch(localMinutes, prefHour, prefMinute)) {
          if (todaySentSlots.includes(timeSlot)) {
            alreadySentForSlot++;
            console.log(
              `[Daily Items Reminder] User ${pref.user_id.substring(0, 8)}: Already sent for slot ${timeSlot} today`,
            );
            continue;
          }
          eligibleUsers.push({ pref, matchedSlot: timeSlot, localDateStr });
          break;
        }
      }
    }

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users due for items reminder at this time",
        checked_at_utc: `${currentHour}:${String(currentMinute).padStart(2, "0")}`,
        total_enabled: preferences.length,
        already_sent_for_slot: alreadySentForSlot,
      });
    }

    let notificationsSent = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let skippedNoItems = 0;

    for (const { pref, matchedSlot, localDateStr } of eligibleUsers) {
      const userId = pref.user_id;
      const prefId = pref.id;
      const [slotHour] = parseTime(matchedSlot);
      const isMorning = slotHour < 12;

      let title: string;
      let message: string;
      let icon: string;
      let severity: string;

      if (isMorning) {
        // Query items due today for this user
        const { data: todayItems, error: morningQueryError } = await supabase
          .from("items")
          .select(
            `id, type, title, status, reminder_details(due_at), event_details(start_at)`,
          )
          .eq("responsible_user_id", userId)
          .is("archived_at", null)
          .or("status.is.null,status.eq.pending,status.eq.in_progress");

        if (morningQueryError) {
          console.error(
            `[Daily Items Reminder] User ${userId.substring(0, 8)}: Morning query failed:`,
            morningQueryError,
          );
          continue;
        }

        console.log(
          `[Daily Items Reminder] User ${userId.substring(0, 8)}: Morning query returned ${todayItems?.length ?? 0} active items`,
        );

        // Filter in JS: tasks/reminders with due_at today, events with start_at today
        // Use user's local date for the "today" check
        const dueToday = (todayItems || []).filter((item) => {
          if (item.type === "task" || item.type === "reminder") {
            const rd = Array.isArray(item.reminder_details)
              ? item.reminder_details[0]
              : item.reminder_details;
            if (!rd?.due_at) return false;
            return rd.due_at.startsWith(localDateStr);
          }
          if (item.type === "event") {
            const ed = Array.isArray(item.event_details)
              ? item.event_details[0]
              : item.event_details;
            if (!ed?.start_at) return false;
            return ed.start_at.startsWith(localDateStr);
          }
          return false;
        });

        if (dueToday.length === 0) {
          skippedNoItems++;
          console.log(
            `[Daily Items Reminder] User ${userId.substring(0, 8)}: No items today, skipping morning`,
          );
          continue;
        }

        const count = dueToday.length;
        title = `You have ${count} item${count === 1 ? "" : "s"} today 📋`;
        message = buildItemsSummaryMessage(
          dueToday.map((i) => i.title),
          count,
        );
        icon = "📋";
        severity = "info";
      } else {
        // Query overdue items for this user
        const { data: allActiveItems, error: eveningQueryError } =
          await supabase
            .from("items")
            .select(
              `id, type, title, status, reminder_details(due_at), event_details(end_at)`,
            )
            .eq("responsible_user_id", userId)
            .is("archived_at", null)
            .or("status.is.null,status.eq.pending,status.eq.in_progress");

        if (eveningQueryError) {
          console.error(
            `[Daily Items Reminder] User ${userId.substring(0, 8)}: Evening query failed:`,
            eveningQueryError,
          );
          continue;
        }

        console.log(
          `[Daily Items Reminder] User ${userId.substring(0, 8)}: Evening query returned ${allActiveItems?.length ?? 0} active items`,
        );

        const nowISO = now.toISOString();
        const overdueItems = (allActiveItems || []).filter((item) => {
          if (item.type === "task" || item.type === "reminder") {
            const rd = Array.isArray(item.reminder_details)
              ? item.reminder_details[0]
              : item.reminder_details;
            if (!rd?.due_at) return false;
            return rd.due_at < nowISO;
          }
          if (item.type === "event") {
            const ed = Array.isArray(item.event_details)
              ? item.event_details[0]
              : item.event_details;
            if (!ed?.end_at) return false;
            return ed.end_at < nowISO;
          }
          return false;
        });

        if (overdueItems.length === 0) {
          skippedNoItems++;
          console.log(
            `[Daily Items Reminder] User ${userId.substring(0, 8)}: No overdue items, skipping evening`,
          );
          continue;
        }

        const count = overdueItems.length;
        title = `${count} overdue item${count === 1 ? "" : "s"} need attention ⚠️`;
        message = buildItemsSummaryMessage(
          overdueItems.map((i) => i.title),
          count,
        );
        icon = "⚠️";
        severity = "warning";
      }

      // Create in-app notification
      const { data: notification, error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          notification_type: "daily_reminder",
          title,
          message,
          icon,
          severity,
          source: "system",
          priority: isMorning ? "normal" : "high",
          action_type: "confirm",
          action_url: "/items",
          expires_at: new Date(
            now.getTime() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          push_status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          `[Daily Items Reminder] Failed to create notification for ${userId}:`,
          insertError,
        );
        continue;
      }

      // Update deduplication metadata
      const currentMetadata =
        typeof pref.metadata === "string"
          ? JSON.parse(pref.metadata)
          : pref.metadata || {};

      const lastSentSlots: Record<string, string[]> =
        currentMetadata.last_sent_slots || {};

      if (!lastSentSlots[localDateStr]) {
        lastSentSlots[localDateStr] = [];
      }
      lastSentSlots[localDateStr].push(matchedSlot);

      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      for (const date of Object.keys(lastSentSlots)) {
        if (date < threeDaysAgo) {
          delete lastSentSlots[date];
        }
      }

      await supabase
        .from("notification_preferences")
        .update({
          last_sent_at: now.toISOString(),
          metadata: { ...currentMetadata, last_sent_slots: lastSentSlots },
        })
        .eq("id", prefId);

      notificationsSent++;

      // Send push notification
      {
        const payload = JSON.stringify({
          title,
          body: message,
          icon: "/appicon-192.png",
          badge: "/appicon-192.png",
          tag: `daily-items-reminder-${todayUTC}-${matchedSlot.replace(/:/g, "")}`,
          data: {
            type: "daily_reminder",
            notification_id: notification.id,
            action_url: "/items",
          },
        });

        const pushResult = await sendPushToUser(
          supabase,
          userId,
          payload,
          notification.id,
        );
        if (pushResult.sent > 0) pushSent++;
        if (pushResult.allFailed) pushFailed++;
      }
    }

    return NextResponse.json({
      success: true,
      notifications_sent: notificationsSent,
      push_sent: pushSent,
      push_failed: pushFailed,
      skipped_no_items: skippedNoItems,
      checked_at_utc: `${currentHour}:${String(currentMinute).padStart(2, "0")}`,
      date: todayUTC,
    });
  } catch (error) {
    console.error("[Daily Items Reminder] Cron error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
