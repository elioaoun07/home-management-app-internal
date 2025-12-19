// src/app/api/notifications/send-transaction-reminders/route.ts
// API route to send daily transaction reminders at user's preferred time
// Called by cron job every minute, checks notification_preferences for users due
// Uses the unified notifications table

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const CRON_SECRET = process.env.CRON_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Get message based on time of day
function getReminderMessage(reminderTime: string): {
  title: string;
  body: string;
  isYesterday: boolean;
} {
  const [hours] = reminderTime.split(":").map(Number);
  const isYesterday = hours < 12;

  if (isYesterday) {
    return {
      title: "📝 Quick check-in",
      body: "Did you log all of yesterday's transactions?",
      isYesterday: true,
    };
  } else {
    return {
      title: "📝 Daily check-in",
      body: "Have you added all of today's transactions?",
      isYesterday: false,
    };
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Push notifications not configured" },
      { status: 500 }
    );
  }

  try {
    const supabase = supabaseAdmin();
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}:00`;

    console.log(`[Transaction Reminders] Current UTC time: ${currentTime}`);

    // Find users with preference set for this exact minute
    const { data: duePreferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("preference_key", "daily_transaction_reminder")
      .eq("enabled", true)
      .eq("preferred_time", currentTime);

    if (prefError) {
      console.error("Failed to get preferences:", prefError);
      return NextResponse.json({ error: prefError.message }, { status: 500 });
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
    const today = now.toISOString().split("T")[0];
    const groupKey = `daily_reminder_${today}`;

    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("notification_type", "daily_reminder")
      .eq("group_key", groupKey);

    const alreadyNotifiedUserIds = new Set(
      (existingNotifications || []).map((n) => n.user_id)
    );

    const filteredPreferences = duePreferences.filter(
      (pref) => !alreadyNotifiedUserIds.has(pref.user_id)
    );

    if (filteredPreferences.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "All users already notified today",
      });
    }

    console.log(
      `[Transaction Reminders] Processing ${filteredPreferences.length} users`
    );

    let totalSent = 0;
    let totalFailed = 0;

    for (const pref of filteredPreferences) {
      const userId = pref.user_id;

      // Get push subscriptions
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`[Transaction Reminders] No subscriptions for ${userId}`);
        continue;
      }

      const { title, body, isYesterday } = getReminderMessage(
        pref.preferred_time
      );

      // Create unified notification
      const { data: notification } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          notification_type: "daily_reminder",
          title,
          message: body,
          icon: "📝",
          severity: "info",
          source: "system",
          priority: "normal",
          action_type: "log_transaction",
          action_url: "/expense",
          action_data: { isYesterday },
          group_key: groupKey,
          expires_at: new Date(
            now.getTime() + 24 * 60 * 60 * 1000
          ).toISOString(),
          push_status: "pending",
        })
        .select()
        .single();

      // Send push notifications
      const payload = JSON.stringify({
        title,
        body,
        icon: "/appicon-192.png",
        badge: "/appicon-192.png",
        tag: `daily-reminder-${userId}`,
        data: {
          type: "daily_reminder",
          notification_id: notification?.id,
          isYesterday,
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

          await supabase
            .from("notifications")
            .update({
              push_status: "sent",
              push_sent_at: new Date().toISOString(),
            })
            .eq("id", notification?.id);

          totalSent++;
        } catch (error: unknown) {
          console.error(`[Transaction Reminders] Push failed:`, error);

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
              push_error: error instanceof Error ? error.message : "Unknown",
            })
            .eq("id", notification?.id);

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
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
