/**
 * Daily Transaction Reminder - Unified Cron Endpoint
 *
 * This is the ONLY cron job for daily reminders. It:
 * 1. Runs every 5 minutes (configure in Vercel/cron service)
 * 2. Checks each user's preferred_time in notification_preferences
 * 3. Creates in-app notification + sends push when their time is due
 * 4. Uses group_key to prevent duplicates per day
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
    
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log("[Daily Reminder] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Daily Reminder] Missing Supabase credentials");
      return NextResponse.json(
        { error: "Server configuration error: Missing Supabase credentials" },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date();
    const todayUTC = now.toISOString().split("T")[0];
    const groupKey = `daily_reminder_${todayUTC}`;

    // Current UTC time (hour and minute)
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(
      `[Daily Reminder] Running at ${currentHour}:${String(currentMinute).padStart(2, "0")} UTC`
    );

    try {
    // Get all users with daily_transaction_reminder enabled
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id, preferred_time, timezone, metadata")
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

    // Get users who already received today's notification
    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("group_key", groupKey);

    const alreadyNotifiedIds = new Set(
      (existingNotifications || []).map((n) => n.user_id)
    );

    // Filter to users whose preferred_time is NOW (within 5 min window)
    // and haven't been notified today
    const eligibleUsers: typeof preferences = [];

    for (const pref of preferences) {
      // Skip if already notified today
      if (alreadyNotifiedIds.has(pref.user_id)) continue;

      // Parse preferred_time (format: "HH:MM:SS" or "HH:MM")
      const [prefHour, prefMinute] = (pref.preferred_time || "20:00:00")
        .split(":")
        .map(Number);

      // Check if current UTC time matches preferred time (within 5 min window)
      // This runs every 5 minutes, so we check if we're within the window
      const prefTotalMinutes = prefHour * 60 + prefMinute;
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      // Match if within 0-4 minutes after preferred time
      const diff = currentTotalMinutes - prefTotalMinutes;
      const isTimeMatch = diff >= 0 && diff < 5;

      // Also handle midnight wraparound (e.g., pref=23:58, current=00:02)
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
        already_notified: alreadyNotifiedIds.size,
      });
    }

    console.log(
      `[Daily Reminder] ${eligibleUsers.length} users due for reminder`
    );

    let created = 0;
    let pushSent = 0;
    let pushFailed = 0;

    for (const pref of eligibleUsers) {
      const userId = pref.user_id;

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

      // Create notification
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
            route: "/expense",
          },
          group_key: groupKey,
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

      created++;

      // Send push notification (only if not already logged today - no need to pester them)
      if (!hasLogged && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", userId)
          .eq("is_active", true);

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title,
            body: message,
            icon: "/appicon-192.png",
            badge: "/appicon-192.png",
            tag: `daily-reminder-${userId}`,
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

              // Update push status
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

              // Deactivate invalid subscriptions
              const statusCode =
                error && typeof error === "object" && "statusCode" in error
                  ? (error as { statusCode: number }).statusCode
                  : null;

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
        }
      }
    }

    return NextResponse.json({
      success: true,
      notifications_created: created,
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
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
  } catch (outerError) {
    console.error("Daily reminder fatal error:", outerError);
    return NextResponse.json(
      { 
        error: "Fatal error in daily reminder",
        message: outerError instanceof Error ? outerError.message : "Unknown error",
        stack: outerError instanceof Error ? outerError.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req);
}
