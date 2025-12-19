/**
 * Daily Transaction Logging Reminder
 * Cron endpoint that creates notifications for users to log their transactions
 *
 * This should be called by a cron job. It:
 * 1. Creates an in-app notification (shows in bell icon)
 * 2. Optionally sends a push notification (if user has subscriptions)
 *
 * Vercel Cron config in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/notifications/daily-reminder",
 *     "schedule": "0 20 * * *"  // 8 PM UTC daily
 *   }]
 * }
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
  // Verify cron secret for security
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split("T")[0];
  const groupKey = `daily_reminder_${today}`;

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, full_name, timezone")
      .not("id", "is", null);

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: "No users to notify", count: 0 });
    }

    // Get users who have disabled this notification
    const { data: disabledPrefs } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("preference_key", "daily_transaction_reminder")
      .eq("enabled", false);

    const disabledUserIds = new Set(
      (disabledPrefs || []).map((p) => p.user_id)
    );

    // Get users who already have today's notification
    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("group_key", groupKey);

    const existingUserIds = new Set(
      (existingNotifications || []).map((n) => n.user_id)
    );

    // Filter eligible users
    const eligibleUsers = users.filter(
      (user) => !disabledUserIds.has(user.id) && !existingUserIds.has(user.id)
    );

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        message: "All eligible users already notified or disabled",
        count: 0,
      });
    }

    let notificationsCreated = 0;
    let pushSent = 0;

    for (const user of eligibleUsers) {
      // Check if user logged transactions today
      const { count: todayTransactions } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("date", today);

      const hasLoggedToday = (todayTransactions || 0) > 0;

      const title = hasLoggedToday
        ? "Great job logging today! 🎉"
        : "Did you log all your spending today?";

      const message = hasLoggedToday
        ? `You've logged ${todayTransactions} transaction${todayTransactions === 1 ? "" : "s"} today. Keep it up!`
        : "Take a moment to log your spending. It helps you stay on budget!";

      // Create unified notification
      const { data: notification, error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_id: user.id,
          notification_type: "daily_reminder",
          title,
          message,
          icon: hasLoggedToday ? "✅" : "📝",
          severity: hasLoggedToday ? "success" : "info",
          source: "system",
          priority: hasLoggedToday ? "low" : "normal",
          action_type: hasLoggedToday ? "confirm" : "log_transaction",
          action_url: hasLoggedToday ? null : "/expense",
          action_data: hasLoggedToday
            ? { transactions_count: todayTransactions }
            : { route: "/expense", date: today },
          group_key: groupKey,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          push_status: "pending", // Mark for push sending
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          `Error creating notification for ${user.id}:`,
          insertError
        );
        continue;
      }

      notificationsCreated++;

      // Send push notification if user has subscriptions
      if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && !hasLoggedToday) {
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title,
            body: message,
            icon: "/appicon-192.png",
            badge: "/appicon-192.png",
            tag: `daily-reminder-${user.id}`,
            data: {
              type: "daily_reminder",
              notification_id: notification?.id,
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

              // Update notification push status
              await supabase
                .from("notifications")
                .update({
                  push_status: "sent",
                  push_sent_at: new Date().toISOString(),
                })
                .eq("id", notification?.id);
            } catch (error: unknown) {
              console.error(`Push failed for ${user.id}:`, error);

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
                    error instanceof Error ? error.message : "Unknown error",
                })
                .eq("id", notification?.id);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${notificationsCreated} notifications, sent ${pushSent} push notifications`,
      notifications_created: notificationsCreated,
      push_sent: pushSent,
      date: today,
    });
  } catch (error) {
    console.error("Daily reminder error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(req: NextRequest) {
  return GET(req);
}
