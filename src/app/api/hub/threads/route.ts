import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch all chat threads for household
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get household ID for this user
  const { data: household } = await supabase
    .from("household_links")
    .select("id, owner_user_id, partner_user_id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({
      threads: [],
      household_id: null,
      current_user_id: user.id,
    });
  }

  // Fetch threads for this household with last message preview
  // Filter: show public threads OR private threads created by current user
  // Also filter out soft-deleted threads
  const { data: threads, error } = await supabase
    .from("hub_chat_threads")
    .select(
      `
      *,
      last_message:hub_messages(
        id,
        content,
        sender_user_id,
        created_at
      )
    `,
    )
    .eq("household_id", household.id)
    .eq("is_archived", false)
    .is("deleted_at", null)
    .or(`is_private.eq.false,and(is_private.eq.true,created_by.eq.${user.id})`)
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("Error fetching threads:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // OPTIMIZED: Batch fetch all messages and receipts for all threads at once
  // instead of N+1 queries per thread
  const threadIds = (threads || []).map((t) => t.id);

  // Single query to get all messages from all threads
  // IMPORTANT: Exclude archived messages from unread count calculation
  const { data: allMessages } =
    threadIds.length > 0
      ? await supabase
          .from("hub_messages")
          .select("id, sender_user_id, thread_id")
          .in("thread_id", threadIds)
          .is("archived_at", null)
          .is("deleted_at", null)
      : { data: [] };

  // Get all message IDs from other users (messages I need receipts for)
  const otherUserMessageIds = (allMessages || [])
    .filter((m) => m.sender_user_id !== user.id)
    .map((m) => m.id);

  // Single query to get all my read receipts
  const { data: allReceipts } =
    otherUserMessageIds.length > 0
      ? await supabase
          .from("hub_message_receipts")
          .select("message_id, status")
          .eq("user_id", user.id)
          .in("message_id", otherUserMessageIds)
      : { data: [] };

  // Build a Set of read message IDs for O(1) lookup
  const readMessageIds = new Set(
    (allReceipts || [])
      .filter((r) => r.status === "read")
      .map((r) => r.message_id),
  );

  // Group messages by thread for unread count calculation
  type MessageType = NonNullable<typeof allMessages>[number];
  const messagesByThread = (allMessages || []).reduce(
    (acc, msg) => {
      if (!acc[msg.thread_id]) acc[msg.thread_id] = [];
      acc[msg.thread_id]!.push(msg);
      return acc;
    },
    {} as Record<string, MessageType[]>,
  );

  // Build final threads with unread counts
  const threadsWithUnread = (threads || []).map((thread) => {
    const threadMessages = messagesByThread[thread.id] || [];
    const otherUserMsgs = threadMessages.filter(
      (m) => m.sender_user_id !== user.id,
    );
    const unreadCount = otherUserMsgs.filter(
      (m) => !readMessageIds.has(m.id),
    ).length;

    // Get the most recent message for preview
    const lastMessage = Array.isArray(thread.last_message)
      ? thread.last_message.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0]
      : thread.last_message;

    return {
      ...thread,
      last_message: lastMessage || null,
      unread_count: unreadCount,
    };
  });

  return NextResponse.json({
    threads: threadsWithUnread,
    household_id: household.id,
    current_user_id: user.id,
  });
}

// POST - Create a new chat thread
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
    description,
    icon,
    household_id,
    purpose,
    external_url,
    external_app_name,
    is_private,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json(
      { error: "Thread title required" },
      { status: 400 },
    );
  }

  if (!household_id) {
    return NextResponse.json(
      { error: "Household ID required" },
      { status: 400 },
    );
  }

  // Verify user belongs to this household
  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .eq("id", household_id)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ error: "Invalid household" }, { status: 403 });
  }

  // Create thread with purpose and privacy setting
  const { data: thread, error } = await supabase
    .from("hub_chat_threads")
    .insert({
      household_id,
      created_by: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      icon: icon || "💬",
      purpose: purpose || "general",
      external_url: external_url || null,
      external_app_name: external_app_name || null,
      is_private: is_private || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ thread });
}

// PATCH - Update thread settings
export async function PATCH(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { thread_id, enable_item_urls, icon, color, is_private } = body;

  if (!thread_id) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  // Verify user belongs to this thread's household
  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("household_id")
    .eq("id", thread_id)
    .single();

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .eq("id", thread.household_id)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json(
      { error: "Not authorized for this thread" },
      { status: 403 },
    );
  }

  // Update thread settings
  const updates: Record<string, unknown> = {};
  if (enable_item_urls !== undefined) {
    updates.enable_item_urls = enable_item_urls;
  }
  if (icon !== undefined) {
    updates.icon = icon;
  }
  if (color !== undefined) {
    updates.color = color;
  }
  if (is_private !== undefined) {
    updates.is_private = is_private;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid updates provided" },
      { status: 400 },
    );
  }

  const { error: updateError, data } = await supabase
    .from("hub_chat_threads")
    .update(updates)
    .eq("id", thread_id)
    .select()
    .single();

  if (updateError) {
    console.error("Thread update error:", {
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      code: updateError.code,
    });

    // Check if it's a missing column error
    if (
      updateError.message?.includes("enable_item_urls") ||
      updateError.code === "42703"
    ) {
      return NextResponse.json(
        {
          error: "Database migration required",
          message:
            "Please run the add_message_archiving.sql migration to add the enable_item_urls column",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: updateError.message || "Failed to update thread",
        code: updateError.code,
        details: updateError.details,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, updates, thread: data });
}

// DELETE - Soft delete a thread (can be undone within 1 day)
export async function DELETE(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const thread_id = searchParams.get("thread_id");
  const undo = searchParams.get("undo") === "true";

  if (!thread_id) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  // Verify user belongs to this thread's household
  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("household_id, created_by, deleted_at")
    .eq("id", thread_id)
    .single();

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: household } = await supabase
    .from("household_links")
    .select("id, owner_user_id, partner_user_id")
    .eq("id", thread.household_id)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json(
      { error: "Not authorized for this thread" },
      { status: 403 },
    );
  }

  // Handle undo - restore the thread
  if (undo) {
    if (!thread.deleted_at) {
      return NextResponse.json(
        { error: "Thread is not deleted" },
        { status: 400 },
      );
    }

    // Check if within 1 day undo window
    const deletedAt = new Date(thread.deleted_at);
    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (now.getTime() - deletedAt.getTime() > dayInMs) {
      return NextResponse.json(
        { error: "Undo window has expired (1 day)" },
        { status: 400 },
      );
    }

    const { error: restoreError } = await supabase
      .from("hub_chat_threads")
      .update({ deleted_at: null })
      .eq("id", thread_id);

    if (restoreError) {
      return NextResponse.json(
        { error: "Failed to restore thread" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, restored: true, thread_id });
  }

  // Soft delete - set deleted_at timestamp
  const { error: deleteError } = await supabase
    .from("hub_chat_threads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", thread_id);

  if (deleteError) {
    console.error("Thread delete error:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete thread" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deleted: true,
    thread_id,
    // Client can use this to show undo option
    undo_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}
