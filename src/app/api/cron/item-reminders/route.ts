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

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/pushSender";
import { buildFullRRuleString } from "@/lib/utils/date";
import { RRule } from "rrule";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret (required — never skip)
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();

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
        offset_minutes,
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
          item_recurrence_rules (id, rrule, start_anchor, end_until, count)
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
        item_recurrence_rules: {
          id: string;
          rrule: string;
          start_anchor: string;
          end_until: string | null;
          count: number | null;
        }[] | null;
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

        const pushResult = await sendPushToUser(
          supabase,
          userId,
          payload,
          notification?.id,
        );
        if (pushResult.sent > 0) sent++;
        if (pushResult.allFailed) failed++;
      } // End of userId loop

      // Mark alert as fired (after all users have been notified)
      await supabase
        .from("item_alerts")
        .update({ last_fired_at: now.toISOString() })
        .eq("id", alert.id);

      // For recurring items, advance trigger_at to the next occurrence.
      // We advance by the interval between occurrences (nextOcc - currentOcc),
      // which naturally preserves any custom fire time (e.g. "8pm") without
      // needing a separate custom_time column.
      const rule = item?.item_recurrence_rules?.[0];
      const offsetMinutes = (alert as unknown as { offset_minutes: number | null }).offset_minutes;
      if (rule && alert.trigger_at && offsetMinutes != null) {
        const firedTriggerAt = new Date(alert.trigger_at);
        // Current event start = trigger_at + offset_minutes
        const currentEventTime = new Date(
          firedTriggerAt.getTime() + offsetMinutes * 60 * 1000,
        );
        const rruleStr = buildFullRRuleString(new Date(rule.start_anchor), rule);
        const nextOcc = RRule.fromString(rruleStr).after(currentEventTime, false);
        if (nextOcc) {
          // Advance by the exact gap between occurrences — preserves custom time
          const interval = nextOcc.getTime() - currentEventTime.getTime();
          const newTriggerAt = new Date(
            firedTriggerAt.getTime() + interval,
          ).toISOString();
          await supabase
            .from("item_alerts")
            .update({ trigger_at: newTriggerAt, last_fired_at: null })
            .eq("id", alert.id);
          console.log(
            `[Item Reminders] Rescheduled alert ${alert.id} → ${newTriggerAt}`,
          );
        } else {
          // Series is done — deactivate the alert
          await supabase
            .from("item_alerts")
            .update({ active: false })
            .eq("id", alert.id);
          console.log(
            `[Item Reminders] Alert ${alert.id} deactivated — no more occurrences`,
          );
        }
      }
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
