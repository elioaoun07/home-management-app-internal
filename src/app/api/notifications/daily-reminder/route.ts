/**
 * Daily Transaction Logging Reminder
 * Cron endpoint that generates in-app notifications for users
 * to remind them to log their daily transactions
 *
 * This should be called once per day, ideally in the evening (e.g., 8 PM user time)
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

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret for security
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role for server-side operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split("T")[0];
  const groupKey = `daily_transaction_reminder_${today}`;

  try {
    // Get all users who have enabled this notification (or haven't explicitly disabled it)
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

    // Get users who have explicitly disabled this notification
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
      .from("in_app_notifications")
      .select("user_id")
      .eq("group_key", groupKey);

    const existingUserIds = new Set(
      (existingNotifications || []).map((n) => n.user_id)
    );

    // Filter users who should receive the notification
    const eligibleUsers = users.filter(
      (user) => !disabledUserIds.has(user.id) && !existingUserIds.has(user.id)
    );

    if (eligibleUsers.length === 0) {
      return NextResponse.json({
        message: "All eligible users already notified or disabled",
        count: 0,
      });
    }

    // For each eligible user, check if they logged any transactions today
    const notificationsToCreate = [];

    for (const user of eligibleUsers) {
      // Check if user has logged transactions today
      const { count: todayTransactions } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", `${today}T00:00:00Z`)
        .lte("created_at", `${today}T23:59:59Z`);

      // Create notification based on whether they've logged today
      const hasLoggedToday = (todayTransactions || 0) > 0;

      notificationsToCreate.push({
        user_id: user.id,
        title: hasLoggedToday
          ? "Great job logging today! 🎉"
          : "Don't forget to log your transactions!",
        message: hasLoggedToday
          ? `You've logged ${todayTransactions} transaction${todayTransactions === 1 ? "" : "s"} today. Keep up the good work!`
          : "Take a moment to log your spending for today. It helps you stay on top of your budget!",
        icon: hasLoggedToday ? "✅" : "📝",
        source: "system",
        priority: hasLoggedToday ? "low" : "normal",
        action_type: hasLoggedToday ? "confirm" : "log_transaction",
        action_data: hasLoggedToday
          ? { transactions_count: todayTransactions }
          : { route: "/expense", date: today },
        group_key: groupKey,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expires in 24 hours
      });
    }

    // Batch insert notifications
    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("in_app_notifications")
        .insert(notificationsToCreate);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${notificationsToCreate.length} daily reminder notifications`,
      count: notificationsToCreate.length,
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
