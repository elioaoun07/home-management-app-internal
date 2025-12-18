// src/app/api/notifications/send-transaction-reminders/route.ts
// API route to send daily transaction reminders
// Called by cron job, checks notification_preferences and sends push notifications

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// Secret key to authorize cron job calls
const CRON_SECRET = process.env.CRON_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Get the appropriate message based on time of day
function getReminderMessage(reminderTime: string): {
  title: string;
  body: string;
  isYesterday: boolean;
} {
  const [hours] = reminderTime.split(":").map(Number);
  const isYesterday = hours < 12; // Before noon = ask about yesterday

  if (isYesterday) {
    const messages = [
      {
        title: "📝 Quick check-in",
        body: "Did you log all of yesterday's transactions?",
      },
      {
        title: "💰 Yesterday's expenses",
        body: "Have you recorded all your spending from yesterday?",
      },
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    return { ...msg, isYesterday: true };
  } else {
    const messages = [
      {
        title: "📝 Daily check-in",
        body: "Have you added all of today's transactions?",
      },
      {
        title: "💰 Quick finance check",
        body: "Did you log all your spending today?",
      },
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    return { ...msg, isYesterday: false };
  }
}

export async function POST(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Push notifications not configured - missing VAPID keys" },
      { status: 500 }
    );
  }

  try {
    const supabase = supabaseAdmin();
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    // Format current time as HH:MM for comparison
    const currentTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}:00`;

    console.log(`[Transaction Reminders] Current UTC time: ${currentTime}`);

    // Find users with daily_transaction_reminder preference set for this exact minute
    const { data: duePreferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("preference_key", "daily_transaction_reminder")
      .eq("enabled", true)
      .eq("preferred_time", currentTime);

    console.log(
      `[Transaction Reminders] Found ${duePreferences?.length || 0} matching preferences`
    );

    if (prefError) {
      console.error("Failed to get due preferences:", prefError);
      return NextResponse.json(
        { error: "Failed to get due preferences", details: prefError.message },
        { status: 500 }
      );
    }

    if (!duePreferences || duePreferences.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No transaction reminders due",
        current_utc_time: currentTime,
      });
    }

    // Check for already-sent reminders today
    const today = new Date().toISOString().split("T")[0];
    const groupKey = `daily_transaction_reminder_${today}`;

    const { data: existingAlerts } = await supabase
      .from("hub_alerts")
      .select("user_id")
      .eq("alert_type", "transaction_reminder")
      .gte("created_at", `${today}T00:00:00Z`);

    const alreadySentUserIds = new Set(
      (existingAlerts || []).map((a) => a.user_id)
    );

    const filteredPreferences = duePreferences.filter(
      (pref) => !alreadySentUserIds.has(pref.user_id)
    );

    if (filteredPreferences.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "All users already notified today",
      });
    }

    console.log(
      `[Transaction Reminders] Found ${filteredPreferences.length} due reminders`
    );

    let totalSent = 0;
    let totalFailed = 0;

    for (const pref of filteredPreferences) {
      const userId = pref.user_id;

      // Get user's push subscriptions
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!subscriptions || subscriptions.length === 0) {
        console.log(
          `[Transaction Reminders] No subscriptions for user ${userId}`
        );
        continue;
      }

      // Get the appropriate message
      const { title, body, isYesterday } = getReminderMessage(
        pref.preferred_time
      );

      // Create BOTH hub_alert and in_app_notification for this reminder
      const today = new Date().toISOString().split("T")[0];
      const groupKey = `daily_transaction_reminder_${today}`;

      // 1. Create hub_alert (for Hub Alerts tab)
      const { data: alert } = await supabase
        .from("hub_alerts")
        .insert({
          user_id: userId,
          alert_type: "transaction_reminder",
          severity: "info",
          title: title,
          message: body,
          action_type: "transaction_reminder",
          action_url: "/dashboard?action=add-expense",
          metadata: { isYesterday },
          expires_at: new Date(
            now.getTime() + 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select()
        .single();

      // 2. Create in_app_notification (for notification center/badge)
      await supabase.from("in_app_notifications").insert({
        user_id: userId,
        title: title,
        message: body,
        icon: "📝",
        source: "system",
        priority: "normal",
        action_type: "log_transaction",
        action_data: { route: "/dashboard?action=add-expense" },
        group_key: groupKey,
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // Build notification payload
      const payload = JSON.stringify({
        title,
        body,
        icon: "/appicon-192.png",
        badge: "/appicon-192.png",
        tag: `transaction-reminder-${userId}`,
        data: {
          type: "transaction_reminder",
          alert_id: alert?.id,
          isYesterday,
          action_url: "/hub?view=alerts",
        },
      });

      // Send to all user's subscriptions
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );

          // Log the notification
          await supabase.from("notification_logs").insert({
            user_id: userId,
            alert_id: alert?.id,
            subscription_id: sub.id,
            title,
            body,
            tag: `transaction-reminder-${userId}`,
            status: "sent",
            sent_at: new Date().toISOString(),
          });

          totalSent++;
        } catch (error: unknown) {
          console.error(`[Transaction Reminders] Failed to send:`, error);

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

          totalFailed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: totalSent,
      failed: totalFailed,
      reminders_processed: filteredPreferences.length,
    });
  } catch (error) {
    console.error("[Transaction Reminders] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to send transaction reminders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(req: NextRequest) {
  return POST(req);
}
