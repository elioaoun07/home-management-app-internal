/**
 * Item Reminders Cron Endpoint
 *
 * Sends push notifications for due item_alerts (tasks, reminders, events).
 * This is SEPARATE from daily transaction reminders.
 *
 * Cron schedule: every 1 minute
 * Endpoint: GET /api/cron/item-reminders
 *
 * What this does:
 * 1. Finds item_alerts with trigger_at in the past hour that haven't fired
 * 2. Creates a notification in the unified notifications table
 * 3. Sends push notification to user's devices
 * 4. Marks alert as fired
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
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Push notifications not configured" },
      { status: 500 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Missing Supabase credentials" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    // Get due alerts that haven't been fired
    const { data: dueAlerts, error: alertsError } = await supabase
      .from("item_alerts")
      .select(
        `
        id,
        item_id,
        trigger_at,
        channel,
        items (
          id,
          user_id,
          responsible_user_id,
          notify_all_household,
          title,
          description,
          type,
          priority,
          item_recurrence_rules (id)
        )
      `,
      )
      .eq("active", true)
      .eq("channel", "push")
      .lte("trigger_at", now.toISOString())
      .gte("trigger_at", oneHourAgo.toISOString())
      .is("last_fired_at", null);

    if (alertsError) {
      console.error("Failed to get due alerts:", alertsError);
      return NextResponse.json({ error: alertsError.message }, { status: 500 });
    }

    if (!dueAlerts || dueAlerts.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No due item alerts",
      });
    }

    console.log(`[Item Reminders] Processing ${dueAlerts.length} due alerts`);

    let sent = 0;
    let failed = 0;

    for (const alert of dueAlerts) {
      // Supabase returns a single object for many-to-one relations (item_alerts -> items)
      const item = alert.items as unknown as {
        id: string;
        user_id: string;
        responsible_user_id: string | null;
        notify_all_household: boolean | null;
        title: string;
        description: string | null;
        type: string;
        priority: string;
        item_recurrence_rules: { id: string }[] | null;
      } | null;

      if (!item) {
        console.log(
          `[Item Reminders] Alert ${alert.id} has no associated item, skipping`,
        );
        continue;
      }

      // Determine which users should receive the notification
      let targetUserIds: string[] = [];

      if (item.notify_all_household) {
        // Get all household members for this item's owner
        const { data: householdLink } = await supabase
          .from("household_links")
          .select("owner_user_id, partner_user_id")
          .or(
            `owner_user_id.eq.${item.user_id},partner_user_id.eq.${item.user_id}`,
          )
          .eq("active", true)
          .maybeSingle();

        if (householdLink) {
          // Include both owner and partner
          targetUserIds = [
            householdLink.owner_user_id,
            householdLink.partner_user_id,
          ].filter((id): id is string => !!id);
          console.log(
            `[Item Reminders] notify_all_household=true, sending to ${targetUserIds.length} household members`,
          );
        } else {
          // Fallback to just the owner if no household link found
          targetUserIds = [item.user_id];
        }
      } else {
        // Send notification to the responsible user (who should do the task)
        // Falls back to owner if no responsible user is set
        const userId = item.responsible_user_id || item.user_id;
        targetUserIds = [userId];
      }

      // Determine notification type based on item type
      const notificationType =
        item.type === "event" ? "item_due" : "item_reminder";
      const icon =
        item.type === "event" ? "📅" : item.type === "task" ? "✅" : "⏰";

      // Send notification to each target user
      for (const userId of targetUserIds) {
        // Create notification in unified table
        const { data: notification, error: insertError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            notification_type: notificationType,
            title: item.title,
            message: item.description || `Your ${item.type} is due now`,
            icon,
            severity: item.priority === "urgent" ? "warning" : "info",
            source: "item",
            priority: item.priority || "normal",
            action_type: "complete_task",
            action_url: null, // Items are viewed via reminder tab, not direct URL
            action_data: {
              item_id: item.id,
              alert_id: alert.id,
              item_type: item.type,
            },
            item_id: item.id,
            group_key: `item_${item.id}_${alert.id}_${userId}`,
            expires_at: new Date(
              now.getTime() + 24 * 60 * 60 * 1000,
            ).toISOString(),
            push_status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          console.error(
            `Failed to create notification for user ${userId}:`,
            insertError,
          );
          continue;
        }

        // Get user's push subscriptions - ORDER BY last_used_at DESC to get the most recent
        // The most recently used subscription is most likely to be valid
        const { data: subscriptions } = await supabase
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth, device_name, last_used_at")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("last_used_at", { ascending: false });

        if (subscriptions && subscriptions.length > 0) {
          console.log(
            `[Item Reminders] User ${userId.substring(0, 8)} has ${subscriptions.length} active subscription(s)`,
          );

          // IMPORTANT: Only send to the MOST RECENT subscription (first one after ordering)
          // This avoids sending to stale endpoints that haven't been cleaned up yet
          const primarySub = subscriptions[0];
          console.log(
            `[Item Reminders] Sending to: ${primarySub.device_name} (last used: ${primarySub.last_used_at})`,
          );

          const payload = JSON.stringify({
            title: item.title,
            body: item.description || `Your ${item.type} is due now`,
            icon: "/appicon-192.png",
            badge: "/appicon-192.png",
            tag: `item-${item.id}-${userId}`,
            data: {
              type: notificationType,
              notification_id: notification?.id,
              item_id: item.id,
              item_title: item.title,
              alert_id: alert.id,
              occurrence_date: new Date().toISOString().split("T")[0],
              is_recurring: !!item.item_recurrence_rules?.length,
              url: `/expense?tab=reminder&item=${item.id}`,
            },
          });

          // Send ONLY to the primary (most recent) subscription
          try {
            await webpush.sendNotification(
              {
                endpoint: primarySub.endpoint,
                keys: { p256dh: primarySub.p256dh, auth: primarySub.auth },
              },
              payload,
            );

            sent++;
            console.log(
              `[Item Reminders] ✓ Push sent successfully to ${primarySub.device_name}`,
            );

            // Update push status
            await supabase
              .from("notifications")
              .update({
                push_status: "sent",
                push_sent_at: new Date().toISOString(),
              })
              .eq("id", notification?.id);

            // Update last_used_at to keep track of which subscriptions are working
            await supabase
              .from("push_subscriptions")
              .update({ last_used_at: new Date().toISOString() })
              .eq("id", primarySub.id);
          } catch (error: unknown) {
            failed++;
            console.error(
              `[Item Reminders] ✗ Push failed to ${primarySub.device_name}:`,
              error,
            );

            const statusCode =
              error && typeof error === "object" && "statusCode" in error
                ? (error as { statusCode: number }).statusCode
                : null;

            // Mark subscription as inactive if it's definitively gone
            if (statusCode === 404 || statusCode === 410) {
              console.log(
                `[Item Reminders] Marking subscription ${primarySub.id} as inactive (status ${statusCode})`,
              );
              await supabase
                .from("push_subscriptions")
                .update({ is_active: false })
                .eq("id", primarySub.id);

              // Try the next subscription if primary failed
              if (subscriptions.length > 1) {
                const fallback = subscriptions[1];
                console.log(
                  `[Item Reminders] Trying fallback: ${fallback.device_name}`,
                );
                try {
                  await webpush.sendNotification(
                    {
                      endpoint: fallback.endpoint,
                      keys: { p256dh: fallback.p256dh, auth: fallback.auth },
                    },
                    payload,
                  );
                  sent++;
                  failed--; // Undo the failed count
                  console.log(
                    `[Item Reminders] ✓ Fallback succeeded to ${fallback.device_name}`,
                  );
                } catch (fallbackError) {
                  console.error(
                    `[Item Reminders] Fallback also failed:`,
                    fallbackError,
                  );
                }
              }
            }

            await supabase
              .from("notifications")
              .update({
                push_status: "failed",
                push_error: error instanceof Error ? error.message : "Unknown",
              })
              .eq("id", notification?.id);
          }
        } else {
          console.log(
            `[Item Reminders] No active subscriptions for user ${userId.substring(0, 8)}`,
          );
        }
      } // End of userId loop

      // Mark alert as fired (after all users have been notified)
      await supabase
        .from("item_alerts")
        .update({ last_fired_at: now.toISOString() })
        .eq("id", alert.id);
    }

    return NextResponse.json({
      success: true,
      processed: dueAlerts.length,
      push_sent: sent,
      push_failed: failed,
    });
  } catch (error) {
    console.error("Item reminders cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// Support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req);
}
