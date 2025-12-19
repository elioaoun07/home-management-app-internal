/**
 * Unified Notification Actions Endpoint
 *
 * Handles all notification actions:
 * - POST: Perform action on notification (confirm, dismiss, snooze)
 * - PATCH: Update notification status
 *
 * Replaces the old separate dismiss and transaction-reminder routes.
 */

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notification_id, action, snooze_minutes } = body;

    if (!notification_id) {
      return NextResponse.json(
        { error: "notification_id is required" },
        { status: 400 }
      );
    }

    // Verify notification belongs to user
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notification_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    switch (action) {
      case "dismiss": {
        const { error } = await supabase
          .from("notifications")
          .update({
            dismissed_at: new Date().toISOString(),
            action_taken: true,
          })
          .eq("id", notification_id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, action: "dismissed" });
      }

      case "snooze": {
        const minutes = snooze_minutes || 30;
        const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);

        const { error } = await supabase
          .from("notifications")
          .update({
            snoozed_until: snoozeUntil.toISOString(),
            snooze_count: (notification.snooze_count || 0) + 1,
          })
          .eq("id", notification_id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          action: "snoozed",
          snoozed_until: snoozeUntil.toISOString(),
        });
      }

      case "confirm": {
        // User confirmed they logged transactions
        const { error } = await supabase
          .from("notifications")
          .update({
            action_taken: true,
            action_taken_at: new Date().toISOString(),
          })
          .eq("id", notification_id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, action: "confirmed" });
      }

      case "complete_task": {
        // Mark the associated item as complete
        const { error: notifError } = await supabase
          .from("notifications")
          .update({
            action_taken: true,
            action_taken_at: new Date().toISOString(),
            dismissed_at: new Date().toISOString(),
          })
          .eq("id", notification_id);

        if (notifError) {
          return NextResponse.json(
            { error: notifError.message },
            { status: 500 }
          );
        }

        // If there's an associated item, mark it complete
        if (notification.item_id) {
          await supabase
            .from("items")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", notification.item_id);
        }

        return NextResponse.json({ success: true, action: "task_completed" });
      }

      case "read": {
        const { error } = await supabase
          .from("notifications")
          .update({
            read_at: new Date().toISOString(),
          })
          .eq("id", notification_id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, action: "read" });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Notification action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Batch update notifications
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { notification_ids, action } = body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json(
        { error: "notification_ids array is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "read_all": {
        const { error } = await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .in("id", notification_ids);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          updated: notification_ids.length,
        });
      }

      case "dismiss_all": {
        const { error } = await supabase
          .from("notifications")
          .update({
            dismissed_at: new Date().toISOString(),
            action_taken: true,
          })
          .eq("user_id", user.id)
          .in("id", notification_ids);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          updated: notification_ids.length,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Notification batch action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
