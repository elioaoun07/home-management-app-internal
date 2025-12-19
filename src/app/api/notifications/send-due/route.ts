// src/app/api/notifications/send-due/route.ts
// API route to check for due alerts and send push notifications
// This should be called by a cron job every minute

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

// Secret key to authorize cron job calls
const CRON_SECRET = process.env.CRON_SECRET;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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

  let supabase;
  try {
    supabase = supabaseAdmin();
  } catch (e) {
    return NextResponse.json(
      {
        error: "Database not configured",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }

  try {
    // Time window for due alerts
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // OPTIMIZATION: Quick existence check using the has_pending_alerts function
    // This uses the partial index and returns immediately if nothing is due
    // Avoids expensive JOINs when there's nothing to process
    const { data: hasAlerts, error: checkError } = await supabase.rpc(
      "has_pending_alerts",
      {
        p_since: oneHourAgo.toISOString(),
        p_until: now.toISOString(),
      }
    );

    if (checkError) {
      // Fallback: if the function doesn't exist yet, continue with regular query
      console.log(
        "[Send-Due] has_pending_alerts not available, using fallback"
      );
    } else if (!hasAlerts) {
      // Fast path: no pending alerts, return immediately
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No due alerts",
        optimized: true,
      });
    }

    // Get all due alerts that haven't been fired yet
    // We look for alerts where:
    // - trigger_at is in the past (due)
    // - trigger_at is within the last hour (not too old)
    // - active is true
    // - last_fired_at is null (hasn't been sent yet)
    // NOTE: This query uses idx_item_alerts_pending_notifications partial index
    const { data: dueAlerts, error: alertsError } = await supabase
      .from("item_alerts")
      .select(
        `
        id,
        item_id,
        trigger_at,
        channel,
        last_fired_at,
        items (
          id,
          user_id,
          title,
          description,
          type,
          priority,
          reminder_details (
            due_at
          )
        )
      `
      )
      .eq("active", true)
      .eq("channel", "push")
      .lte("trigger_at", now.toISOString())
      .gte("trigger_at", oneHourAgo.toISOString())
      .is("last_fired_at", null);

    if (alertsError) {
      console.error("Failed to get due alerts:", alertsError);
      return NextResponse.json(
        { error: "Failed to get due alerts", details: alertsError.message },
        { status: 500 }
      );
    }

    if (!dueAlerts || dueAlerts.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No due alerts",
      });
    }

    console.log(`[Send-Due] Found ${dueAlerts.length} due alerts`);

    // Group alerts by user
    const alertsByUser = new Map<string, typeof dueAlerts>();
    for (const alert of dueAlerts) {
      const item = alert.items as unknown as {
        id: string;
        user_id: string;
        title: string;
        description: string | null;
        type: string;
        priority: string;
        reminder_details: { due_at: string } | null;
      };

      if (!item) continue;

      const userId = item.user_id;
      if (!alertsByUser.has(userId)) {
        alertsByUser.set(userId, []);
      }
      alertsByUser.get(userId)!.push(alert);
    }

    let totalSent = 0;
    let totalFailed = 0;

    // Process each user's alerts
    for (const [userId, userAlerts] of alertsByUser) {
      // Get user's push subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (subError || !subscriptions || subscriptions.length === 0) {
        console.log(`[Send-Due] No subscriptions for user ${userId}`);
        continue;
      }

      // Send notification for each due alert
      for (const alert of userAlerts) {
        const item = alert.items as unknown as {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          type: string;
          priority: string;
          reminder_details: { due_at: string } | null;
        };

        if (!item) continue;

        // Build notification payload
        const priorityEmoji = getPriorityEmoji(item.priority);
        const payload = JSON.stringify({
          title: `${priorityEmoji} ${item.title}`,
          body: item.description || "Reminder is due now",
          icon: "/appicon-192.png",
          badge: "/appicon-192.png",
          tag: `reminder-${item.id}`,
          data: {
            type: "item_reminder",
            item_id: item.id,
            alert_id: alert.id,
            due_at: item.reminder_details?.due_at || alert.trigger_at,
            priority: item.priority,
          },
        });

        // Create unified notification entry
        const { data: notification } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            notification_type: "item_reminder",
            title: `${priorityEmoji} ${item.title}`,
            message: item.description || "Reminder is due now",
            icon: priorityEmoji,
            severity:
              item.priority === "urgent"
                ? "error"
                : item.priority === "high"
                  ? "warning"
                  : "info",
            source: "item",
            priority: item.priority as "low" | "normal" | "high" | "urgent",
            action_url: `/reminders/${item.id}`,
            item_id: item.id,
            push_status: "pending",
          })
          .select()
          .single();

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

            // Update notification with push status
            if (notification) {
              await supabase
                .from("notifications")
                .update({
                  push_status: "sent",
                  push_sent_at: new Date().toISOString(),
                })
                .eq("id", notification.id);
            }

            totalSent++;
          } catch (error: unknown) {
            console.error(
              `[Send-Due] Failed to send to ${sub.endpoint}:`,
              error
            );
            totalFailed++;

            // If subscription is invalid, mark it as inactive
            const webPushError = error as { statusCode?: number };
            if (
              webPushError.statusCode === 410 ||
              webPushError.statusCode === 404
            ) {
              await supabase
                .from("push_subscriptions")
                .update({ is_active: false })
                .eq("id", sub.id);
            }

            // Update notification with failure
            if (notification) {
              await supabase
                .from("notifications")
                .update({
                  push_status: "failed",
                  push_error:
                    error instanceof Error ? error.message : "Unknown error",
                })
                .eq("id", notification.id);
            }
          }
        }

        // Mark alert as fired
        await supabase
          .from("item_alerts")
          .update({ last_fired_at: new Date().toISOString() })
          .eq("id", alert.id);
      }
    }

    console.log(
      `[Send-Due] Completed: ${totalSent} sent, ${totalFailed} failed`
    );

    return NextResponse.json({
      success: true,
      sent: totalSent,
      failed: totalFailed,
      alerts_processed: dueAlerts.length,
    });
  } catch (error) {
    console.error("Error in send-due route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(req: NextRequest) {
  return POST(req);
}

function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case "urgent":
      return "🚨";
    case "high":
      return "❗";
    case "normal":
      return "🔔";
    case "low":
      return "📝";
    default:
      return "🔔";
  }
}
