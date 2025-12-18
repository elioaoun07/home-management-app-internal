/**
 * Sync Cron Notifications to In-App
 * This endpoint syncs notifications that were pushed via cron jobs
 * into the in_app_notifications table so they appear when the user opens the app.
 *
 * Called automatically when the user opens the app or periodically.
 */

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get recent notification logs that haven't been synced to in-app yet
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentLogs, error: logsError } = await supabase
      .from("notification_logs")
      .select(
        `
        id,
        user_id,
        alert_id,
        title,
        body,
        priority,
        status,
        created_at,
        item_alerts!inner (
          item_id,
          items (
            id,
            title,
            type,
            priority
          )
        )
      `
      )
      .eq("user_id", user.id)
      .gte("created_at", oneDayAgo)
      .in("status", ["sent", "clicked"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (logsError) {
      console.error("Error fetching notification logs:", logsError);
      // Continue anyway, this is a nice-to-have sync
    }

    // Get hub alerts that should also appear as in-app notifications
    const { data: hubAlerts, error: alertsError } = await supabase
      .from("hub_alerts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_dismissed", false)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    if (alertsError) {
      console.error("Error fetching hub alerts:", alertsError);
    }

    let syncedCount = 0;

    // Sync notification logs (pushed via cron for items/reminders)
    if (recentLogs && recentLogs.length > 0) {
      for (const log of recentLogs) {
        const groupKey = `notification_log_${log.id}`;

        // Check if already synced
        const { data: existing } = await supabase
          .from("in_app_notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("group_key", groupKey)
          .single();

        if (!existing) {
          // Handle nested relation - item_alerts is an array, get the first item's items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const itemAlerts = log.item_alerts as any;
          const itemData =
            itemAlerts?.[0]?.items?.[0] || itemAlerts?.[0]?.items || null;

          const { error: insertError } = await supabase
            .from("in_app_notifications")
            .insert({
              user_id: user.id,
              title: log.title || "Reminder",
              message: log.body,
              icon: itemData?.type === "event" ? "📅" : "⏰",
              source: "cron",
              priority: log.priority || "normal",
              action_type:
                itemData?.type === "reminder"
                  ? "complete_task"
                  : "view_details",
              action_data: {
                item_id: itemData?.id,
                alert_id: log.alert_id,
                log_id: log.id,
              },
              item_id: itemData?.id || null,
              group_key: groupKey,
            });

          if (!insertError) {
            syncedCount++;
          }
        }
      }
    }

    // Sync hub alerts
    if (hubAlerts && hubAlerts.length > 0) {
      for (const alert of hubAlerts) {
        const groupKey = `hub_alert_${alert.id}`;

        // Check if already synced
        const { data: existing } = await supabase
          .from("in_app_notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("group_key", groupKey)
          .single();

        if (!existing) {
          // Map hub alert type to icon
          const iconMap: Record<string, string> = {
            budget_warning: "⚠️",
            budget_exceeded: "🚨",
            bill_due: "📅",
            goal_milestone: "🎉",
            weekly_summary: "📊",
            monthly_summary: "📊",
            unusual_spending: "💸",
            streak_at_risk: "🔥",
          };

          // Map severity to priority
          const priorityMap: Record<
            string,
            "low" | "normal" | "high" | "urgent"
          > = {
            info: "low",
            success: "normal",
            warning: "high",
            action: "urgent",
          };

          const { error: insertError } = await supabase
            .from("in_app_notifications")
            .insert({
              user_id: user.id,
              title: alert.title,
              message: alert.message,
              icon: iconMap[alert.alert_type] || "💡",
              source: "alert",
              priority: priorityMap[alert.severity] || "normal",
              action_type: "view_details",
              action_data: {
                alert_type: alert.alert_type,
                alert_id: alert.id,
                route: "/hub?view=alerts",
              },
              alert_id: alert.id,
              group_key: groupKey,
            });

          if (!insertError) {
            syncedCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      logs_checked: recentLogs?.length || 0,
      alerts_checked: hubAlerts?.length || 0,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
