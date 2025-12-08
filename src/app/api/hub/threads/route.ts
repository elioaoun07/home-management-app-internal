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
    `
    )
    .eq("household_id", household.id)
    .eq("is_archived", false)
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("Error fetching threads:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // OPTIMIZED: Batch fetch all messages and receipts for all threads at once
  // instead of N+1 queries per thread
  const threadIds = (threads || []).map((t) => t.id);

  // Single query to get all messages from all threads
  const { data: allMessages } =
    threadIds.length > 0
      ? await supabase
          .from("hub_messages")
          .select("id, sender_user_id, thread_id")
          .in("thread_id", threadIds)
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
      .map((r) => r.message_id)
  );

  // Group messages by thread for unread count calculation
  const messagesByThread = (allMessages || []).reduce(
    (acc, msg) => {
      if (!acc[msg.thread_id]) acc[msg.thread_id] = [];
      acc[msg.thread_id]!.push(msg);
      return acc;
    },
    {} as Record<string, typeof allMessages>
  );

  // Build final threads with unread counts
  const threadsWithUnread = (threads || []).map((thread) => {
    const threadMessages = messagesByThread[thread.id] || [];
    const otherUserMsgs = threadMessages.filter(
      (m) => m.sender_user_id !== user.id
    );
    const unreadCount = otherUserMsgs.filter(
      (m) => !readMessageIds.has(m.id)
    ).length;

    // Get the most recent message for preview
    const lastMessage = Array.isArray(thread.last_message)
      ? thread.last_message.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
  } = body;

  if (!title?.trim()) {
    return NextResponse.json(
      { error: "Thread title required" },
      { status: 400 }
    );
  }

  if (!household_id) {
    return NextResponse.json(
      { error: "Household ID required" },
      { status: 400 }
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

  // Create thread with purpose and external app info
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ thread });
}
