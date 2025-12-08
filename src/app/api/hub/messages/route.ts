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

  // CHANGED: Don't filter out hidden messages - include them so we can show undo button
  // Mark each message as hidden or visible for the current user
  const visibleMessages = (messages || []).map((msg) => {
    const hiddenFor = msg.hidden_for || [];
    return {
      ...msg,
      is_hidden_by_me: hiddenFor.includes(user.id),
    };
  });

  // Get all message IDs from others (messages I need receipts for)
  const otherUserMessageIds = visibleMessages
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

  for (const msg of visibleMessages) {
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
    const readAt = new Date().toISOString();

    // OPTIMIZED: Batch upsert all receipts at once instead of loop
    // Separate new receipts from updates
    const newReceiptIds = unreadMessageIds.filter(
      (msgId) => !myReceipts[msgId]
    );
    const updateReceiptIds = unreadMessageIds.filter(
      (msgId) => myReceipts[msgId] && myReceipts[msgId] !== "read"
    );

    // Batch insert new receipts
    if (newReceiptIds.length > 0) {
      const newReceipts = newReceiptIds.map((msgId) => ({
        message_id: msgId,
        user_id: user.id,
        status: "read",
        read_at: readAt,
      }));
      await supabase.from("hub_message_receipts").insert(newReceipts);
    }

    // Batch update existing receipts (update all at once using IN clause)
    if (updateReceiptIds.length > 0) {
      await supabase
        .from("hub_message_receipts")
        .update({
          status: "read",
          read_at: readAt,
        })
        .eq("user_id", user.id)
        .in("message_id", updateReceiptIds);
    }
  }

  // Get receipt statuses for messages I sent (to show sent/delivered/read to me)
  const myMessageIds = visibleMessages
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

  // OPTIMIZED: Fetch message actions inline to avoid separate API call
  const allMessageIds = visibleMessages.map((msg) => msg.id);
  let messageActions: any[] = [];
  if (allMessageIds.length > 0) {
    const { data: actions } = await supabase
      .from("hub_message_actions")
      .select("*")
      .in("message_id", allMessageIds);
    messageActions = actions || [];
  }

  // Transform messages with proper status
  const transformedMessages = visibleMessages.map((msg) => {
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
    message_actions: messageActions, // Include actions in response
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

/**
 * DELETE - Soft delete messages for everyone (mark as deleted)
 * Body: { messageIds: string[] }
 * Only message owners can delete their own messages for everyone
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messageIds } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: "messageIds array is required" },
        { status: 400 }
      );
    }

    // First verify user has access to all messages
    const { data: messages, error: verifyError } = await supabase
      .from("hub_messages")
      .select(
        `
        id,
        thread_id,
        sender_user_id,
        hub_chat_threads!inner (
          id,
          household_id
        )
      `
      )
      .in("id", messageIds);

    if (verifyError) {
      return NextResponse.json(
        { error: "Failed to verify messages" },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found" }, { status: 404 });
    }

    // Check that user belongs to the household
    const householdIds = [
      ...new Set(messages.map((m: any) => m.hub_chat_threads.household_id)),
    ];

    for (const householdId of householdIds) {
      const { data: link } = await supabase
        .from("household_links")
        .select("id, owner_user_id, partner_user_id")
        .eq("id", householdId)
        .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
        .eq("active", true)
        .maybeSingle();

      if (!link) {
        return NextResponse.json(
          { error: "Unauthorized to delete messages in this household" },
          { status: 403 }
        );
      }
    }

    // Only allow users to delete their own messages
    const unauthorizedMessages = messages.filter(
      (m: any) => m.sender_user_id !== user.id
    );

    if (unauthorizedMessages.length > 0) {
      return NextResponse.json(
        { error: "You can only delete your own messages" },
        { status: 403 }
      );
    }

    // Soft delete: mark messages as deleted instead of removing them
    const { error: deleteError } = await supabase
      .from("hub_messages")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .in("id", messageIds);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: messageIds.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Handle message actions (hide, unhide, or undo)
 * Body: { messageIds: string[], action: 'hide' | 'unhide' | 'undo' }
 *
 * - 'hide': Adds the current user's ID to the hidden_for array (both users can hide any message)
 * - 'unhide': Removes the current user's ID from the hidden_for array (undo "delete for me")
 * - 'undo': Removes deleted_at/deleted_by for message owners to undo deletion
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messageIds, action } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: "messageIds array is required" },
        { status: 400 }
      );
    }

    if (action !== "hide" && action !== "unhide" && action !== "undo") {
      return NextResponse.json(
        { error: "Invalid action. Use 'hide', 'unhide', or 'undo'." },
        { status: 400 }
      );
    }

    // Verify user has access to all messages
    const { data: messages, error: verifyError } = await supabase
      .from("hub_messages")
      .select(
        `
        id,
        sender_user_id,
        hub_chat_threads!inner (
          id,
          household_id
        )
      `
      )
      .in("id", messageIds);

    if (verifyError) {
      return NextResponse.json(
        { error: "Failed to verify messages" },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found" }, { status: 404 });
    }

    // Check household membership
    const householdIds = [
      ...new Set(messages.map((m: any) => m.hub_chat_threads.household_id)),
    ];

    for (const householdId of householdIds) {
      const { data: link } = await supabase
        .from("household_links")
        .select("id, owner_user_id, partner_user_id")
        .eq("id", householdId)
        .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
        .eq("active", true)
        .maybeSingle();

      if (!link) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    // Handle undo action
    if (action === "undo") {
      // Only allow users to undo their own deletions
      const unauthorizedMessages = messages.filter(
        (m: any) => m.sender_user_id !== user.id
      );

      if (unauthorizedMessages.length > 0) {
        return NextResponse.json(
          { error: "You can only undo your own deletions" },
          { status: 403 }
        );
      }

      // Remove deletion markers
      const { error: undoError } = await supabase
        .from("hub_messages")
        .update({
          deleted_at: null,
          deleted_by: null,
        })
        .in("id", messageIds);

      if (undoError) {
        return NextResponse.json(
          { error: "Failed to undo deletion" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        undoCount: messageIds.length,
      });
    }

    // Handle unhide action
    if (action === "unhide") {
      // Remove user ID from hidden_for array for each message
      for (const messageId of messageIds) {
        const { data: currentMessage } = await supabase
          .from("hub_messages")
          .select("hidden_for")
          .eq("id", messageId)
          .single();

        const currentHiddenFor = currentMessage?.hidden_for || [];

        // Remove user ID from the array
        const updatedHiddenFor = currentHiddenFor.filter(
          (id: string) => id !== user.id
        );

        const { error: updateError } = await supabase
          .from("hub_messages")
          .update({ hidden_for: updatedHiddenFor })
          .eq("id", messageId);

        if (updateError) {
          return NextResponse.json(
            { error: "Failed to unhide message" },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        unhiddenCount: messageIds.length,
      });
    }

    // Handle hide action
    // Add user ID to hidden_for array for each message
    // This allows both household users to hide messages ("delete for me")
    for (const messageId of messageIds) {
      // First get the current hidden_for array
      const { data: currentMessage } = await supabase
        .from("hub_messages")
        .select("hidden_for")
        .eq("id", messageId)
        .single();

      const currentHiddenFor = currentMessage?.hidden_for || [];

      // Add user ID if not already in the array
      if (!currentHiddenFor.includes(user.id)) {
        const updatedHiddenFor = [...currentHiddenFor, user.id];

        const { error: updateError } = await supabase
          .from("hub_messages")
          .update({ hidden_for: updatedHiddenFor })
          .eq("id", messageId);

        if (updateError) {
          return NextResponse.json(
            { error: "Failed to hide message" },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      hiddenCount: messageIds.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
