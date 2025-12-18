import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type InAppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  icon: string;
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
  action_completed_at: string | null;
  alert_id: string | null;
  item_id: string | null;
  transaction_id: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  expires_at: string | null;
  group_key: string | null;
};

// GET - Fetch in-app notifications for user
export async function GET(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const includeRead = searchParams.get("include_read") === "true";

  // Build query
  let query = supabase
    .from("in_app_notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Filter by unread if requested
  if (!includeRead) {
    query = query.eq("is_read", false);
  }

  // Filter out expired notifications
  query = query.or(
    `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`
  );

  const { data: notifications, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get unread count
  const { count: unreadCount } = await supabase
    .from("in_app_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .eq("is_read", false)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  return NextResponse.json({
    notifications: notifications || [],
    unread_count: unreadCount || 0,
  });
}

// POST - Create a new notification (for testing or manual creation)
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
    source = "system",
    priority = "normal",
    action_type,
    action_data,
    group_key,
    expires_at,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Check for duplicate if group_key is provided
  if (group_key) {
    const { data: existing } = await supabase
      .from("in_app_notifications")
      .select("id")
      .eq("user_id", user.id)
      .eq("group_key", group_key)
      .single();

    if (existing) {
      return NextResponse.json({
        message: "Notification already exists",
        notification: existing,
      });
    }
  }

  const { data: notification, error } = await supabase
    .from("in_app_notifications")
    .insert({
      user_id: user.id,
      title,
      message,
      icon,
      source,
      priority,
      action_type,
      action_data,
      group_key,
      expires_at,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notification });
}

// PATCH - Update notification (mark as read, complete action, dismiss)
export async function PATCH(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ids, is_read, is_dismissed, action_completed } = body;

  // Handle bulk update
  if (ids && Array.isArray(ids) && ids.length > 0) {
    const updates: Record<string, boolean | string> = {};
    if (is_read !== undefined) updates.is_read = is_read;
    if (is_dismissed !== undefined) updates.is_dismissed = is_dismissed;
    if (action_completed)
      updates.action_completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("in_app_notifications")
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

  const updates: Record<string, boolean | string> = {};
  if (is_read !== undefined) updates.is_read = is_read;
  if (is_dismissed !== undefined) updates.is_dismissed = is_dismissed;
  if (action_completed) updates.action_completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("in_app_notifications")
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
    .from("in_app_notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
