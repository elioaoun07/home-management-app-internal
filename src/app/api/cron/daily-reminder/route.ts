/**
 * Daily Transaction Reminder - Unified Cron Endpoint
 *
 * SUPPORTS MULTIPLE REMINDER TIMES PER DAY:
 * - `metadata.preferred_times` is an array of LOCAL times (HH:mm:ss) interpreted
 *   in the user's `notification_preferences.timezone`.
 * - `metadata.last_sent_slots` tracks which slots were already sent today
 *   (keyed by the user's local YYYY-MM-DD).
 *
 * Example metadata for a user with timezone="Asia/Beirut":
 * {
 *   "preferred_times": ["07:00:00", "18:00:00"],   // 7 AM and 6 PM Beirut local
 *   "last_sent_slots": { "2026-01-06": ["07:00:00"] }
 * }
 *
 * Users with no row in notification_preferences (or enabled=false) are skipped
 * silently — no error is raised.
 *
 * Cron schedule: every 5 minutes
 * Endpoint: GET /api/cron/daily-reminder
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/pushSender";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

// Helper: Check if current UTC time matches a target time (within 5-minute window)
function isTimeMatch(
  currentTotalMinutes: number,
  targetHour: number,
  targetMinute: number,
): boolean {
  const targetTotalMinutes = targetHour * 60 + targetMinute;

  // Match if within 0-4 minutes after target time
  const diff = currentTotalMinutes - targetTotalMinutes;
  const isMatch = diff >= 0 && diff < 5;

  // Handle midnight wraparound (e.g., target=23:58, current=00:02)
  const diffWrapped = currentTotalMinutes + 1440 - targetTotalMinutes;
  const isMatchWrapped =
    diffWrapped >= 0 && diffWrapped < 5 && targetTotalMinutes > 1435;

  return isMatch || isMatchWrapped;
}

// Helper: Parse time string "HH:MM:SS" or "HH:MM" to [hour, minute]
function parseTime(timeStr: string): [number, number] {
  const [hour, minute] = timeStr.split(":").map(Number);
  return [hour, minute];
}

// Helper: Safely parse the metadata jsonb column into a plain object.
// Never throws — returns {} for null/invalid JSON/non-object values.
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
    console.log("[Daily Reminder] Starting execution");

    // Verify cron secret (required — never skip)
    const authHeader = req.headers.get("authorization");
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log("[Daily Reminder] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    const now = new Date();
    const todayUTC = now.toISOString().split("T")[0];

    // Current UTC time
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    console.log(
      `[Daily Reminder] Running at ${currentHour}:${String(currentMinute).padStart(2, "0")} UTC`,
    );

    // Get all users with daily_transaction_reminder enabled
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("id, user_id, timezone, metadata, last_sent_at")
      .eq("preference_key", "daily_transaction_reminder")
      .eq("enabled", true);

    if (prefError) {
      console.error("Error fetching preferences:", prefError);
      return NextResponse.json({ error: prefError.message }, { status: 500 });
    }

    if (!preferences || preferences.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users with daily reminder enabled",
        checked_at_utc: `${currentHour}:${currentMinute}`,
      });
    }

    // Filter to eligible users based on their preferred times
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
            (t): t is string => typeof t === "string" && /^\d{1,2}:\d{2}/.test(t),
          )
        : ["20:00:00"];

      if (preferredTimes.length === 0) continue;

      // Convert current UTC time → user's local time for comparison
      const userTz = pref.timezone || "UTC";
      const { totalMinutes: localMinutes, dateStr: localDateStr } =
        getLocalTime(userTz);

      // Get already sent slots for today (using user's local date)
      const lastSentSlotsRaw = metadata.last_sent_slots;
      const lastSentSlots: Record<string, string[]> =
        lastSentSlotsRaw && typeof lastSentSlotsRaw === "object"
          ? (lastSentSlotsRaw as Record<string, string[]>)
          : {};
      const todaySentSlots: string[] = lastSentSlots[localDateStr] || [];

      // Check each preferred time
      for (const timeSlot of preferredTimes) {
        const [prefHour, prefMinute] = parseTime(timeSlot);

        // Check if this time slot matches user's current local time
        if (isTimeMatch(localMinutes, prefHour, prefMinute)) {
          // Check if already sent for this specific slot today
          if (todaySentSlots.includes(timeSlot)) {
            alreadySentForSlot++;
            console.log(
              `[Daily Reminder] User ${pref.user_id.substring(0, 8)}: Already sent for slot ${timeSlot} today`,
            );
            continue;
          }

          // Eligible for this time slot!
          eligibleUsers.push({ pref, matchedSlot: timeSlot, localDateStr });
          break; // Only match one slot per user per cron run
        }
      }
    }

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users due for reminder at this time",
        checked_at_utc: `${currentHour}:${String(currentMinute).padStart(2, "0")}`,
        total_enabled: preferences.length,
        already_sent_for_slot: alreadySentForSlot,
      });
    }

    console.log(
      `[Daily Reminder] ${eligibleUsers.length} users due for reminder`,
    );

    let notificationsSent = 0;
    let pushSent = 0;
    let pushFailed = 0;

    for (const { pref, matchedSlot, localDateStr } of eligibleUsers) {
      const userId = pref.user_id;
      const prefId = pref.id;

      // Check if user has logged transactions today
      const { count: todayCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("date", todayUTC);

      const hasLogged = (todayCount || 0) > 0;

      // Build notification content (customize based on morning vs evening)
      const [slotHour] = parseTime(matchedSlot);
      const isMorning = slotHour < 12;

      const title = hasLogged
        ? "Great job logging today! 🎉"
        : isMorning
          ? "Good morning! Ready to track today? ☀️"
          : "Did you log all your spending today?";

      const message = hasLogged
        ? `You've logged ${todayCount} transaction${todayCount === 1 ? "" : "s"} today. Keep it up!`
        : isMorning
          ? "Start your day by logging any purchases. Stay on budget!"
          : "Take a moment to log your spending. It helps you stay on budget!";

      // Create notification (for user to see in-app)
      const { data: notification, error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          notification_type: "daily_reminder",
          title,
          message,
          icon: hasLogged ? "✅" : "📝",
          severity: hasLogged ? "success" : "info",
          source: "system",
          priority: hasLogged ? "low" : "normal",
          action_type: hasLogged ? "confirm" : "log_transaction",
          action_url: "/expense",
          action_data: {
            date: todayUTC,
            transactions_count: todayCount || 0,
          },
          expires_at: new Date(
            now.getTime() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          push_status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          `Failed to create notification for ${userId}:`,
          insertError,
        );
        continue;
      }

      // Update metadata to mark this time slot as sent today (deduplication for multiple times per day)
      const currentMetadata =
        typeof pref.metadata === "string"
          ? JSON.parse(pref.metadata)
          : pref.metadata || {};

      const lastSentSlots: Record<string, string[]> =
        currentMetadata.last_sent_slots || {};

      // Add this slot to today's sent slots (using user's local date)
      if (!lastSentSlots[localDateStr]) {
        lastSentSlots[localDateStr] = [];
      }
      lastSentSlots[localDateStr].push(matchedSlot);

      // Clean up old dates (keep only last 3 days to prevent metadata bloat)
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      for (const date of Object.keys(lastSentSlots)) {
        if (date < threeDaysAgo) {
          delete lastSentSlots[date];
        }
      }

      const updatedMetadata = {
        ...currentMetadata,
        last_sent_slots: lastSentSlots,
      };

      await supabase
        .from("notification_preferences")
        .update({
          last_sent_at: now.toISOString(),
          metadata: updatedMetadata,
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
          tag: `daily-reminder-${todayUTC}-${matchedSlot.replace(/:/g, "")}`,
          data: {
            type: "daily_reminder",
            notification_id: notification.id,
            action_url: "/expense",
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
      checked_at_utc: `${currentHour}:${String(currentMinute).padStart(2, "0")}`,
      date: todayUTC,
    });
  } catch (error) {
    console.error("Daily reminder cron error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

// Support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req);
}
