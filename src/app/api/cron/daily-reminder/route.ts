/**
 * Daily Transaction Reminder - Unified Cron Endpoint
 *
 * OPTIMAL APPROACH:
 * - Uses `last_sent_at` field in notification_preferences for deduplication
 * - Only creates notification for user visibility, not for tracking
 * - Much cleaner than group_key approach
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
      .select("id, user_id, preferred_time, timezone, metadata, last_sent_at")
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

    // Filter to eligible users:
    // 1. preferred_time is NOW (within 5 min window)
    // 2. last_sent_at is NULL or before today
    const eligibleUsers: typeof preferences = [];
    let alreadySentToday = 0;

    for (const pref of preferences) {
      // Check if already sent today
      if (pref.last_sent_at) {
        const lastSentDate = pref.last_sent_at.split("T")[0];
        if (lastSentDate === todayUTC) {
          alreadySentToday++;
          continue; // Already sent today, skip
        }
      }

      // Parse preferred_time (format: "HH:MM:SS" or "HH:MM")
      const [prefHour, prefMinute] = (pref.preferred_time || "20:00:00")
        .split(":")
        .map(Number);

      const prefTotalMinutes = prefHour * 60 + prefMinute;

      // Match if within 0-4 minutes after preferred time
      const diff = currentTotalMinutes - prefTotalMinutes;
      const isTimeMatch = diff >= 0 && diff < 5;

      // Handle midnight wraparound (e.g., pref=23:58, current=00:02)
      const diffWrapped = currentTotalMinutes + 1440 - prefTotalMinutes;
      const isTimeMatchWrapped =
        diffWrapped >= 0 && diffWrapped < 5 && prefTotalMinutes > 1435;

      if (isTimeMatch || isTimeMatchWrapped) {
        eligibleUsers.push(pref);
      }
    }

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users due for reminder at this time",
        checked_at_utc: `${currentHour}:${String(currentMinute).padStart(2, "0")}`,
        total_enabled: preferences.length,
        already_sent_today: alreadySentToday,
      });
    }

    console.log(
      `[Daily Reminder] ${eligibleUsers.length} users due for reminder`
    );

    let notificationsSent = 0;
    let pushSent = 0;
    let pushFailed = 0;

    for (const pref of eligibleUsers) {
      const userId = pref.user_id;
      const prefId = pref.id;

      // Check if user has logged transactions today
      const { count: todayCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("date", todayUTC);

      const hasLogged = (todayCount || 0) > 0;

      // Build notification content
      const title = hasLogged
        ? "Great job logging today! 🎉"
        : "Did you log all your spending today?";

      const message = hasLogged
        ? `You've logged ${todayCount} transaction${todayCount === 1 ? "" : "s"} today. Keep it up!`
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

      // Mark as sent TODAY in preferences (this is the deduplication!)
      await supabase
        .from("notification_preferences")
        .update({ last_sent_at: now.toISOString() })
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
            tag: `daily-reminder-${todayUTC}`,
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
