import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch chat messages for a specific thread
export async function GET(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get thread_id from query params
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("thread_id");
  const markAsRead = searchParams.get("mark_read") !== "false"; // default true

  if (!threadId) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  // Verify user has access to this thread's household
  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("id, household_id")
    .eq("id", threadId)
    .maybeSingle();

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Try to get first unread message ID (gracefully handle if table doesn't exist)
  let firstUnreadMessageId: string | null = null;
  let unreadCount = 0;

  try {
    const { data: firstUnreadData } = await supabase
      .from("hub_message_receipts")
      .select("message_id")
      .eq("user_id", user.id)
      .neq("status", "read")
      .limit(1)
      .maybeSingle();

    firstUnreadMessageId = firstUnreadData?.message_id || null;

    const { count } = await supabase
      .from("hub_message_receipts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "read");

    unreadCount = count || 0;
  } catch {
    // Table doesn't exist yet, use fallback
    firstUnreadMessageId = null;
    unreadCount = 0;
  }

  // Fetch messages for this thread
  const { data: messages, error } = await supabase
    .from("hub_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Try to mark messages as read (gracefully handle if function/table doesn't exist)
  if (markAsRead) {
    try {
      await supabase.rpc("mark_thread_messages_read", {
        p_user_id: user.id,
        p_thread_id: threadId,
      });
    } catch {
      // Function doesn't exist yet, fall back to old method
      await supabase
        .from("hub_messages")
        .update({ is_read: true })
        .eq("thread_id", threadId)
        .neq("sender_user_id", user.id)
        .eq("is_read", false);
    }
  }

  // Get receipt statuses for messages I sent (to show sent/delivered/read status)
  const myMessageIds = (messages || [])
    .filter((msg) => msg.sender_user_id === user.id)
    .map((msg) => msg.id);

  let receiptStatuses: Record<string, string> = {};

  if (myMessageIds.length > 0) {
    try {
      // Use RPC function that bypasses RLS to get receipt statuses
      const { data: receipts, error: receiptsError } = await supabase.rpc(
        "get_message_receipt_statuses",
        { p_message_ids: myMessageIds }
      );

      if (receipts && !receiptsError) {
        // Group receipts by message and find the minimum status
        const statusPriority: Record<string, number> = {
          sent: 0,
          delivered: 1,
          read: 2,
        };

        for (const receipt of receipts) {
          const currentStatus = receiptStatuses[receipt.message_id];
          if (
            !currentStatus ||
            statusPriority[receipt.status] < statusPriority[currentStatus]
          ) {
            receiptStatuses[receipt.message_id] = receipt.status;
          }
        }
      }
    } catch {
      // Function doesn't exist, leave empty
    }
  }

  // Transform messages with proper status
  const transformedMessages = (messages || []).map((msg) => {
    const isMine = msg.sender_user_id === user.id;

    return {
      ...msg,
      // For my messages: show receipt status (sent/delivered/read), default to "sent" if no receipt yet
      // For others' messages: no status needed
      status: isMine
        ? ((receiptStatuses[msg.id] || "sent") as "sent" | "delivered" | "read")
        : undefined,
      is_unread: !isMine && !msg.is_read,
    };
  });

  return NextResponse.json({
    messages: transformedMessages,
    thread_id: threadId,
    household_id: thread.household_id,
    current_user_id: user.id,
    first_unread_message_id: firstUnreadMessageId,
    unread_count: unreadCount || 0,
  });
}

// POST - Send a new message to a thread
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { content, thread_id } = body;

  if (!content?.trim()) {
    return NextResponse.json(
      { error: "Message content required" },
      { status: 400 }
    );
  }

  if (!thread_id) {
    return NextResponse.json({ error: "Thread ID required" }, { status: 400 });
  }

  // Get thread and verify access
  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("id, household_id")
    .eq("id", thread_id)
    .maybeSingle();

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Insert message
  const { data: message, error } = await supabase
    .from("hub_messages")
    .insert({
      household_id: thread.household_id,
      thread_id,
      sender_user_id: user.id,
      message_type: "text",
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting message:", error);
    return NextResponse.json(
      { error: error.message, details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({ message });
}
