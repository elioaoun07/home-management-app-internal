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
  const includeArchived = searchParams.get("include_archived") === "true"; // default false

  if (!threadId) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  // Verify user has access to this thread's household
  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("id, household_id, purpose")
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
  // By default, exclude archived messages for performance
  let query = supabase
    .from("hub_messages")
    .select("*")
    .eq("thread_id", threadId)
    .is("deleted_at", null) // Exclude soft-deleted messages
    .order("created_at", { ascending: true })
    .limit(200);

  // Only include archived if explicitly requested
  if (!includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data: messages, error } = await query;

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
  const { content, thread_id, topic_id, item_quantity } = body;

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

  // Insert message (with optional topic_id and item_quantity)
  const insertData: Record<string, unknown> = {
    household_id: thread.household_id,
    thread_id,
    sender_user_id: user.id,
    message_type: "text",
    content: content.trim(),
  };

  // Add topic_id if provided
  if (topic_id) {
    insertData.topic_id = topic_id;
  }

  // Add item_quantity if provided (for shopping lists)
  if (item_quantity) {
    insertData.item_quantity = item_quantity;
  }

  const { data: message, error } = await supabase
    .from("hub_messages")
    .insert(insertData)
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

    // Optimized: Single query to verify ownership and delete
    // Only allow users to delete their own messages
    const { data: deletedMessages, error: deleteError } = await supabase
      .from("hub_messages")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .in("id", messageIds)
      .eq("sender_user_id", user.id) // Only delete own messages
      .select("id, thread_id");

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete messages" },
        { status: 500 }
      );
    }

    if (!deletedMessages || deletedMessages.length === 0) {
      return NextResponse.json(
        { error: "No messages found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: deletedMessages.length,
    });
  } catch (error) {
    console.error("DELETE /api/hub/messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Handle message actions
 *
 * For hide/unhide/undo actions:
 *   Body: { messageIds: string[], action: 'hide' | 'unhide' | 'undo' }
 *
 * For shopping/archiving actions:
 *   Body: { action: 'toggle_check' | 'clear_checked' | 'archive' | 'unarchive', message_id?: string, thread_id?: string }
 *
 * Actions:
 * - 'hide': Adds the current user's ID to the hidden_for array
 * - 'unhide': Removes the current user's ID from the hidden_for array
 * - 'undo': Removes deleted_at/deleted_by for message owners
 * - 'toggle_check': Toggle check state for shopping items
 * - 'clear_checked': Archive all checked items in a thread
 * - 'archive': Archive specific messages
 * - 'unarchive': Restore archived messages
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
    const { action, messageIds, message_id, message_ids, thread_id, reason } =
      body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    // Handle shopping/archiving actions first (they use different parameters)
    if (
      [
        "toggle_check",
        "toggle_pin",
        "clear_checked",
        "archive",
        "unarchive",
        "set_item_url",
        "set_quantity",
        "update_content",
      ].includes(action)
    ) {
      switch (action) {
        case "set_quantity": {
          if (!message_id) {
            return NextResponse.json(
              { error: "message_id is required" },
              { status: 400 }
            );
          }

          const { quantity } = body;

          // Update item quantity
          const { error: updateError } = await supabase
            .from("hub_messages")
            .update({
              item_quantity: quantity || null,
            })
            .eq("id", message_id);

          if (updateError) {
            return NextResponse.json(
              { error: "Failed to set quantity" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            message_id,
            quantity: quantity || null,
          });
        }

        case "set_item_url": {
          if (!message_id) {
            return NextResponse.json(
              { error: "message_id is required" },
              { status: 400 }
            );
          }

          const { item_url } = body;

          // Validate URL if provided (allow null to clear)
          if (item_url !== null && item_url !== undefined && item_url !== "") {
            try {
              new URL(item_url);
            } catch {
              return NextResponse.json(
                { error: "Invalid URL format" },
                { status: 400 }
              );
            }
          }

          const { error: updateError } = await supabase
            .from("hub_messages")
            .update({
              item_url: item_url || null,
            })
            .eq("id", message_id);

          if (updateError) {
            return NextResponse.json(
              { error: "Failed to set item URL" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            message_id,
            item_url: item_url || null,
          });
        }

        case "toggle_pin": {
          if (!message_id) {
            return NextResponse.json(
              { error: "message_id is required" },
              { status: 400 }
            );
          }

          const { data: message, error: fetchError } = await supabase
            .from("hub_messages")
            .select("pinned_at, thread_id")
            .eq("id", message_id)
            .single();

          if (fetchError || !message) {
            return NextResponse.json(
              { error: "Message not found" },
              { status: 404 }
            );
          }

          const isCurrentlyPinned = !!message.pinned_at;
          const { error: updateError } = await supabase
            .from("hub_messages")
            .update({
              pinned_at: isCurrentlyPinned ? null : new Date().toISOString(),
            })
            .eq("id", message_id);

          if (updateError) {
            return NextResponse.json(
              { error: "Failed to toggle pin" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            pinned: !isCurrentlyPinned,
            message_id,
          });
        }

        case "toggle_check": {
          if (!message_id) {
            return NextResponse.json(
              { error: "message_id is required" },
              { status: 400 }
            );
          }

          const { data: message, error: fetchError } = await supabase
            .from("hub_messages")
            .select("checked_at, thread_id")
            .eq("id", message_id)
            .single();

          if (fetchError || !message) {
            return NextResponse.json(
              { error: "Message not found" },
              { status: 404 }
            );
          }

          const isCurrentlyChecked = !!message.checked_at;
          const newCheckedAt = isCurrentlyChecked
            ? null
            : new Date().toISOString();
          const newCheckedBy = isCurrentlyChecked ? null : user.id;

          const { error: updateError } = await supabase
            .from("hub_messages")
            .update({
              checked_at: newCheckedAt,
              checked_by: newCheckedBy,
            })
            .eq("id", message_id);

          if (updateError) {
            return NextResponse.json(
              { error: "Failed to toggle check" },
              { status: 500 }
            );
          }

          // Broadcast the item check update to other users in the thread
          const threadChannelName = `thread-${message.thread_id}`;
          const realtimeChannel = supabase.channel(threadChannelName);

          await realtimeChannel.subscribe();
          await realtimeChannel.send({
            type: "broadcast",
            event: "item-check-update",
            payload: {
              message_id,
              thread_id: message.thread_id,
              checked_at: newCheckedAt,
              checked_by: newCheckedBy,
              updated_by: user.id,
            },
          });
          await supabase.removeChannel(realtimeChannel);

          return NextResponse.json({
            success: true,
            checked: !isCurrentlyChecked,
            message_id,
          });
        }

        case "update_content": {
          if (!message_id) {
            return NextResponse.json(
              { error: "message_id is required" },
              { status: 400 }
            );
          }

          const { content } = body;
          if (typeof content !== "string") {
            console.error("Invalid content type:", typeof content, content);
            return NextResponse.json(
              { error: "content must be a string" },
              { status: 400 }
            );
          }

          // Verify the message exists and user can edit it
          const { data: message, error: fetchError } = await supabase
            .from("hub_messages")
            .select("sender_user_id, thread_id")
            .eq("id", message_id)
            .single();

          if (fetchError || !message) {
            return NextResponse.json(
              { error: "Message not found" },
              { status: 404 }
            );
          }

          // Only allow editing own messages
          if (message.sender_user_id !== user.id) {
            return NextResponse.json(
              { error: "Can only edit your own messages" },
              { status: 403 }
            );
          }

          console.log(
            "Updating message:",
            message_id,
            "with content:",
            content
          );

          // Update content only (don't include edited_at as column may not exist)
          const { error: updateError } = await supabase
            .from("hub_messages")
            .update({ content: content.trim() })
            .eq("id", message_id);

          if (updateError) {
            console.error("Update message error:", {
              error: updateError,
              message_id,
              content_length: content.length,
            });
            return NextResponse.json(
              {
                error: "Failed to update message",
                details: updateError.message || String(updateError),
              },
              { status: 500 }
            );
          }

          console.log("Message updated successfully:", message_id);
          return NextResponse.json({
            success: true,
            message_id,
          });
        }

        case "clear_checked": {
          if (!thread_id) {
            return NextResponse.json(
              { error: "thread_id is required" },
              { status: 400 }
            );
          }

          const { data: updated, error: updateError } = await supabase
            .from("hub_messages")
            .update({
              archived_at: new Date().toISOString(),
              archived_reason: "shopping_cleared",
            })
            .eq("thread_id", thread_id)
            .not("checked_at", "is", null)
            .is("archived_at", null)
            .select("id");

          if (updateError) {
            return NextResponse.json(
              { error: "Failed to clear items" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            archivedCount: updated?.length || 0,
          });
        }

        case "archive": {
          const ids = message_ids || (message_id ? [message_id] : []);
          if (ids.length === 0) {
            return NextResponse.json(
              { error: "message_id(s) required" },
              { status: 400 }
            );
          }

          const { error: updateError } = await supabase
            .from("hub_messages")
            .update({
              archived_at: new Date().toISOString(),
              archived_reason: reason || "manual",
            })
            .in("id", ids);

          if (updateError) {
            return NextResponse.json(
              { error: "Failed to archive" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            archivedCount: ids.length,
          });
        }

        case "unarchive": {
          const ids = message_ids || (message_id ? [message_id] : []);
          if (ids.length === 0) {
            return NextResponse.json(
              { error: "message_id(s) required" },
              { status: 400 }
            );
          }

          const { error: updateError } = await supabase
            .from("hub_messages")
            .update({
              archived_at: null,
              archived_reason: null,
            })
            .in("id", ids);

          if (updateError) {
            return NextResponse.json(
              { error: "Failed to unarchive" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            restoredCount: ids.length,
          });
        }
      }
    }

    // Handle hide/unhide/undo actions (require messageIds array)
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: "messageIds array is required for hide/unhide/undo actions" },
        { status: 400 }
      );
    }

    if (!["hide", "unhide", "undo"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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
