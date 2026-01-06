import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

// Configure VAPID for push notifications
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Notification types (maps to notification_type_enum in database)
export type NotificationType =
  | "daily_reminder"
  | "weekly_summary"
  | "monthly_summary"
  | "budget_warning"
  | "budget_exceeded"
  | "bill_due"
  | "bill_overdue"
  | "item_reminder"
  | "item_due"
  | "item_overdue"
  | "goal_milestone"
  | "goal_completed"
  | "chat_message"
  | "chat_mention"
  | "transaction_pending"
  | "info"
  | "success"
  | "warning"
  | "error";

// Unified notification type (combines old hub_alerts and in_app_notifications)
export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  icon: string;
  notification_type: NotificationType | null;
  severity: "info" | "success" | "warning" | "error" | "action";
  source:
    | "system"
    | "cron"
    | "alert"
    | "item"
    | "transaction"
    | "budget"
    | "household";
  priority: "low" | "normal" | "high" | "urgent";
  action_type:
    | "confirm"
    | "complete_task"
    | "log_transaction"
    | "view_details"
    | "snooze"
    | "dismiss"
    | null;
  action_data: Record<string, unknown> | null;
  action_url: string | null;
  action_completed_at: string | null;
  action_taken: boolean;
  item_id: string | null;
  transaction_id: string | null;
  recurring_payment_id: string | null;
  category_id: string | null;
  household_id: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  expires_at: string | null;
  group_key: string | null;
  snoozed_until: string | null;
  push_status: "pending" | "sent" | "failed" | "clicked" | "dismissed" | null;
  push_sent_at: string | null;
};

// Legacy type alias for backward compatibility
export type InAppNotification = Notification;

// GET - Fetch notifications for user
export async function GET(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const includeRead = searchParams.get("include_read") === "true";
  const type = searchParams.get("type"); // Filter by notification_type

  // Build query - use unified 'notifications' table
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Filter by unread if requested
  if (!includeRead) {
    query = query.eq("is_read", false);
  }

  // Filter by type if provided
  if (type) {
    query = query.eq("notification_type", type);
  }

  // Filter out expired and snoozed notifications
  const now = new Date().toISOString();
  query = query
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`);

  const { data: notifications, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get unread count
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .eq("is_read", false)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`);

  return NextResponse.json({
    notifications: notifications || [],
    unread_count: unreadCount || 0,
  });
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    title,
    message,
    icon = "bell",
    notification_type = "info",
    severity = "info",
    source = "system",
    priority = "normal",
    action_type,
    action_data,
    action_url,
    group_key,
    expires_at,
    item_id,
    transaction_id,
    recurring_payment_id,
    category_id,
    send_push = false,
    target_user_id, // Optional: create notification for a different user (must be household member)
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Determine target user - default to current user
  let notificationUserId = user.id;

  // If target_user_id is specified, verify it's a valid household member
  if (target_user_id && target_user_id !== user.id) {
    const { data: householdLink } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .maybeSingle();

    if (householdLink) {
      const partnerId =
        householdLink.owner_user_id === user.id
          ? householdLink.partner_user_id
          : householdLink.owner_user_id;

      if (target_user_id === partnerId) {
        notificationUserId = target_user_id;
      } else {
        return NextResponse.json(
          { error: "Target user is not a household member" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "No household link found" },
        { status: 403 }
      );
    }
  }

  // Check for duplicate if group_key is provided
  if (group_key) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", notificationUserId)
      .eq("group_key", group_key)
      .eq("is_dismissed", false)
      .single();

    if (existing) {
      return NextResponse.json({
        message: "Notification already exists",
        notification: existing,
      });
    }
  }

  // Use admin client for insert to bypass RLS (we already verified permissions above)
  const adminClient = supabaseAdmin();
  const { data: notification, error } = await adminClient
    .from("notifications")
    .insert({
      user_id: notificationUserId,
      title,
      message,
      icon,
      notification_type,
      severity,
      source,
      priority,
      action_type,
      action_data,
      action_url,
      group_key,
      expires_at,
      item_id,
      transaction_id,
      recurring_payment_id,
      category_id,
      push_status: send_push ? "pending" : null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send push notification immediately if requested
  if (send_push && notification && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
      // Get user's push subscriptions
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", notificationUserId)
        .eq("is_active", true);

      if (subscriptions && subscriptions.length > 0) {
        const payload = JSON.stringify({
          title,
          body: message || "",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          tag: notification.id,
          data: {
            url: action_url || "/",
            notificationId: notification.id,
          },
        });

        let pushSent = false;
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
            pushSent = true;
          } catch (pushError) {
            const webPushError = pushError as { statusCode?: number };
            // Remove invalid subscriptions (410 Gone or 404 Not Found)
            if (
              webPushError.statusCode === 410 ||
              webPushError.statusCode === 404
            ) {
              // Use admin client to delete expired subscription
              await adminClient
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
              console.log(
                `[in-app] Removed expired push subscription ${sub.id}`
              );
            } else {
              console.error(
                `[in-app] Push failed for subscription ${sub.id}:`,
                pushError
              );
            }
          }
        }

        // Update push status
        await adminClient
          .from("notifications")
          .update({
            push_status: pushSent ? "sent" : "failed",
            push_sent_at: pushSent ? new Date().toISOString() : null,
          })
          .eq("id", notification.id);
      }
    } catch (pushError) {
      console.error("[in-app] Error sending push notification:", pushError);
      // Don't fail the request, notification was still created
    }
  }

  return NextResponse.json({ notification });
}

// PATCH - Update notification (mark as read, complete action, dismiss, snooze)
export async function PATCH(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ids, is_read, is_dismissed, action_completed, snoozed_until } =
    body;

  // Handle bulk update
  if (ids && Array.isArray(ids) && ids.length > 0) {
    const updates: Record<string, boolean | string | null> = {};
    if (is_read !== undefined) updates.is_read = is_read;
    if (is_dismissed !== undefined) updates.is_dismissed = is_dismissed;
    if (action_completed) {
      updates.action_completed_at = new Date().toISOString();
      updates.action_taken = true;
    }
    if (snoozed_until !== undefined) updates.snoozed_until = snoozed_until;

    const { error } = await supabase
      .from("notifications")
      .update(updates)
      .eq("user_id", user.id)
      .in("id", ids);

    if (error) {
      console.error("Error updating notifications:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: ids.length });
  }

  // Single update
  if (!id) {
    return NextResponse.json(
      { error: "Notification ID required" },
      { status: 400 }
    );
  }

  const updates: Record<string, boolean | string | null> = {};
  if (is_read !== undefined) updates.is_read = is_read;
  if (is_dismissed !== undefined) updates.is_dismissed = is_dismissed;
  if (action_completed) {
    updates.action_completed_at = new Date().toISOString();
    updates.action_taken = true;
  }
  if (snoozed_until !== undefined) updates.snoozed_until = snoozed_until;

  const { error } = await supabase
    .from("notifications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error updating notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Notification ID required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
