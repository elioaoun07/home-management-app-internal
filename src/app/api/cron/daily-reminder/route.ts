/**
 * Daily Transaction Reminder - Unified Cron Endpoint
 *
 * SUPPORTS MULTIPLE REMINDER TIMES PER DAY:
 * - Uses `preferred_times` array in metadata for multiple daily reminders
 * - Uses `last_sent_slots` in metadata to track which time slots have been sent today
 *
 * Example metadata:
 * {
 *   "preferred_times": ["05:15:00", "16:00:00"],  // UTC times (7:15 AM and 6:00 PM Beirut)
 *   "last_sent_slots": { "2026-01-06": ["05:15:00"] }  // Already sent for this slot today
 * }
 *
 * Cron schedule: every 5 minutes
 * Endpoint: GET /api/cron/daily-reminder
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Helper: Check if current UTC time matches a target time (within 5-minute window)
function isTimeMatch(
  currentTotalMinutes: number,
  targetHour: number,
  targetMinute: number
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

export async function GET(req: NextRequest) {
  try {
    console.log("[Daily Reminder] Starting execution");

    // Verify cron secret (skip in dev or if not set)
    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log("[Daily Reminder] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Daily Reminder] Missing Supabase credentials");
      return NextResponse.json(
        { error: "Server configuration error: Missing Supabase credentials" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const todayUTC = now.toISOString().split("T")[0];

    // Current UTC time
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    console.log(
      `[Daily Reminder] Running at ${currentHour}:${String(currentMinute).padStart(2, "0")} UTC`
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
    }> = [];
    let alreadySentForSlot = 0;

    for (const pref of preferences) {
      const metadata =
        typeof pref.metadata === "string"
          ? JSON.parse(pref.metadata)
          : pref.metadata || {};

      // Get the list of preferred times (UTC) from metadata
      // Default to 20:00 UTC if not set
      const preferredTimes: string[] = metadata.preferred_times || ["20:00:00"];

      // Get already sent slots for today
      const lastSentSlots: Record<string, string[]> =
        metadata.last_sent_slots || {};
      const todaySentSlots: string[] = lastSentSlots[todayUTC] || [];

      // Check each preferred time
      for (const timeSlot of preferredTimes) {
        const [prefHour, prefMinute] = parseTime(timeSlot);

        // Check if this time slot matches current time
        if (isTimeMatch(currentTotalMinutes, prefHour, prefMinute)) {
          // Check if already sent for this specific slot today
          if (todaySentSlots.includes(timeSlot)) {
            alreadySentForSlot++;
            console.log(
              `[Daily Reminder] User ${pref.user_id}: Already sent for slot ${timeSlot} today`
            );
            continue;
          }

          // Eligible for this time slot!
          eligibleUsers.push({ pref, matchedSlot: timeSlot });
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
      `[Daily Reminder] ${eligibleUsers.length} users due for reminder`
    );

    let notificationsSent = 0;
    let pushSent = 0;
    let pushFailed = 0;

    for (const { pref, matchedSlot } of eligibleUsers) {
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
            now.getTime() + 24 * 60 * 60 * 1000
          ).toISOString(),
          push_status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          `Failed to create notification for ${userId}:`,
          insertError
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

      // Add this slot to today's sent slots
      if (!lastSentSlots[todayUTC]) {
        lastSentSlots[todayUTC] = [];
      }
      lastSentSlots[todayUTC].push(matchedSlot);

      // Clean up old dates (keep only last 7 days to prevent metadata bloat)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      for (const date of Object.keys(lastSentSlots)) {
        if (date < sevenDaysAgo) {
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
      if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", userId)
          .eq("is_active", true);

        console.log(
          `[Daily Reminder] User ${userId}: Found ${subscriptions?.length || 0} active push subscriptions`
        );

        if (subscriptions && subscriptions.length > 0) {
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

          for (const sub of subscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );

              pushSent++;

              await supabase
                .from("notifications")
                .update({
                  push_status: "sent",
                  push_sent_at: new Date().toISOString(),
                })
                .eq("id", notification.id);
            } catch (error: unknown) {
              pushFailed++;
              console.error(`Push failed for user ${userId}:`, error);

              const statusCode =
                error && typeof error === "object" && "statusCode" in error
                  ? (error as { statusCode: number }).statusCode
                  : null;

              // Deactivate invalid subscriptions
              if (statusCode === 404 || statusCode === 410) {
                await supabase
                  .from("push_subscriptions")
                  .update({ is_active: false })
                  .eq("id", sub.id);
              }

              await supabase
                .from("notifications")
                .update({
                  push_status: "failed",
                  push_error:
                    error instanceof Error ? error.message : "Unknown",
                })
                .eq("id", notification.id);
            }
          }
        } else {
          console.log(
            `[Daily Reminder] User ${userId}: No active push subscriptions found`
          );
        }
      } else {
        console.log(
          `[Daily Reminder] VAPID keys not configured, skipping push`
        );
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
      { status: 500 }
    );
  }
}

// Support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req);
}
