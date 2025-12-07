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
    .select("id, owner_user_id, partner_user_id")
    .eq("id", thread.household_id)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get partner user ID
  const partnerUserId =
    household.owner_user_id === user.id
      ? household.partner_user_id
      : household.owner_user_id;

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

  // Get all message IDs from others (messages I need receipts for)
  const otherUserMessageIds = (messages || [])
    .filter((m) => m.sender_user_id !== user.id)
    .map((m) => m.id);

  // Get my receipts for these messages
  let myReceipts: Record<string, string> = {};
  if (otherUserMessageIds.length > 0) {
    const { data: receipts } = await supabase
      .from("hub_message_receipts")
      .select("message_id, status")
      .eq("user_id", user.id)
      .in("message_id", otherUserMessageIds);

    for (const r of receipts || []) {
      myReceipts[r.message_id] = r.status;
    }
  }

  // Find first unread message and count
  // Unread = messages from others where I don't have a 'read' receipt
  let firstUnreadMessageId: string | null = null;
  let unreadCount = 0;
  const unreadMessageIds: string[] = [];

  for (const msg of messages || []) {
    if (msg.sender_user_id !== user.id) {
      const myStatus = myReceipts[msg.id];
      if (myStatus !== "read") {
        if (!firstUnreadMessageId) {
          firstUnreadMessageId = msg.id;
        }
        unreadCount++;
        unreadMessageIds.push(msg.id);
      }
    }
  }

  // Mark messages as read by upserting receipts
  let markedAsReadIds: string[] = [];
  if (markAsRead && unreadMessageIds.length > 0) {
    markedAsReadIds = unreadMessageIds;

    // Upsert receipts for each unread message
    for (const msgId of unreadMessageIds) {
      const existingStatus = myReceipts[msgId];

      if (!existingStatus) {
        // Create new receipt
        await supabase.from("hub_message_receipts").insert({
          message_id: msgId,
          user_id: user.id,
          status: "read",
          read_at: new Date().toISOString(),
        });
      } else if (existingStatus !== "read") {
        // Update existing receipt
        await supabase
          .from("hub_message_receipts")
          .update({
            status: "read",
            read_at: new Date().toISOString(),
          })
          .eq("message_id", msgId)
          .eq("user_id", user.id);
      }
    }
  }

  // Get receipt statuses for messages I sent (to show sent/delivered/read to me)
  const myMessageIds = (messages || [])
    .filter((msg) => msg.sender_user_id === user.id)
    .map((msg) => msg.id);

  let receiptStatuses: Record<string, string> = {};

  if (myMessageIds.length > 0 && partnerUserId) {
    // Get partner's receipts for my messages
    const { data: partnerReceipts } = await supabase
      .from("hub_message_receipts")
      .select("message_id, status")
      .eq("user_id", partnerUserId)
      .in("message_id", myMessageIds);

    for (const r of partnerReceipts || []) {
      receiptStatuses[r.message_id] = r.status;
    }
  }

  // Transform messages with proper status
  const transformedMessages = (messages || []).map((msg) => {
    const isMine = msg.sender_user_id === user.id;

    return {
      ...msg,
      // For my messages: show receipt status (sent/delivered/read)
      // Default to "delivered" since message is saved on server
      status: isMine
        ? ((receiptStatuses[msg.id] || "delivered") as
            | "sent"
            | "delivered"
            | "read")
        : undefined,
      // For others' messages: mark as unread if no 'read' receipt
      is_unread: !isMine && myReceipts[msg.id] !== "read",
    };
  });

  return NextResponse.json({
    messages: transformedMessages,
    thread_id: threadId,
    household_id: thread.household_id,
    current_user_id: user.id,
    first_unread_message_id: firstUnreadMessageId,
    unread_count: unreadCount,
    marked_as_read_ids: markedAsReadIds,
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
    .select("id, owner_user_id, partner_user_id")
    .eq("id", thread.household_id)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Get partner user ID
  const partnerUserId =
    household.owner_user_id === user.id
      ? household.partner_user_id
      : household.owner_user_id;

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

  // Create receipt for partner with status='delivered' (message saved on server)
  if (partnerUserId) {
    await supabase.from("hub_message_receipts").insert({
      message_id: message.id,
      user_id: partnerUserId,
      status: "delivered",
      delivered_at: new Date().toISOString(),
    });
  }

  // Update thread's last_message_at
  await supabase
    .from("hub_chat_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", thread_id);

  // Message successfully saved = delivered status
  return NextResponse.json({
    message: {
      ...message,
      status: "delivered",
    },
  });
}
