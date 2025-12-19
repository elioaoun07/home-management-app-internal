/**
 * Chat Notifications Cron Endpoint
 *
 * Sends push notifications for unread chat messages.
 * Similar to WhatsApp: groups messages by thread, shows count + last message.
 *
 * Cron schedule: every 1 minute
 * Endpoint: GET /api/cron/chat-notifications
 *
 * Logic:
 * 1. Find all unread messages (receipts with status != 'read')
 * 2. Group by thread_id
 * 3. Skip private threads (only creator sees them, no push needed)
 * 4. For each thread: create ONE notification showing count + last message
 * 5. Send push notification
 * 6. Use deduplication to avoid sending same notification multiple times
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function GET(req: NextRequest) {
  try {
    console.log("[Chat Notifications] Starting execution");

    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log("[Chat Notifications] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Chat Notifications] Missing Supabase credentials");
      return NextResponse.json(
        { error: "Server configuration error: Missing Supabase credentials" },
        { status: 500 }
      );
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Push notifications not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();

    // Step 1: Get all unread receipts
    const { data: unreadReceipts, error: receiptsError } = await supabase
      .from("hub_message_receipts")
      .select("id, message_id, user_id, status")
      .neq("status", "read");

    if (receiptsError) {
      console.error("Error fetching unread receipts:", receiptsError);
      return NextResponse.json(
        { error: receiptsError.message },
        { status: 500 }
      );
    }

    if (!unreadReceipts || unreadReceipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unread messages",
        unread_count: 0,
        checked_at: now.toISOString(),
      });
    }

    console.log(
      `[Chat Notifications] Found ${unreadReceipts.length} unread receipts`
    );

    // Step 2: Get the messages for these receipts
    const messageIds = [...new Set(unreadReceipts.map((r) => r.message_id))];

    const { data: messages, error: messagesError } = await supabase
      .from("hub_messages")
      .select(
        "id, content, sender_user_id, thread_id, created_at, household_id"
      )
      .in("id", messageIds);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 }
      );
    }

    // Create a message lookup map
    const messageMap = new Map(messages?.map((m) => [m.id, m]) || []);

    // Step 3: Get thread details (including is_private)
    const threadIds = [
      ...new Set(messages?.map((m) => m.thread_id).filter(Boolean) || []),
    ];

    const { data: threads } = await supabase
      .from("hub_chat_threads")
      .select("id, title, is_private, created_by")
      .in("id", threadIds);

    // Create thread lookup map
    const threadMap = new Map(threads?.map((t) => [t.id, t]) || []);

    console.log(`[Chat Notifications] Thread map contents:`);
    for (const [tid, t] of threadMap) {
      console.log(
        `  Thread ${tid}: is_private=${t.is_private}, title=${t.title}`
      );
    }

    // Step 4: Get sender profiles
    const senderIds = [
      ...new Set(messages?.map((m) => m.sender_user_id) || []),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", senderIds);

    // Create profile lookup map
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    // Step 5: Group receipts by user_id + thread_id
    type GroupedReceipt = {
      receipt_id: string;
      message_id: string;
      content: string | null;
      sender_user_id: string;
      created_at: string;
    };

    const groupedByUser = new Map<string, Map<string, GroupedReceipt[]>>();

    console.log(
      `[Chat Notifications] Processing ${unreadReceipts.length} receipts...`
    );
    console.log(
      `[Chat Notifications] Message map has ${messageMap.size} messages`
    );
    console.log(
      `[Chat Notifications] Thread map has ${threadMap.size} threads`
    );

    for (const receipt of unreadReceipts) {
      console.log(
        `[Chat Notifications] Receipt: message_id=${receipt.message_id}, user_id=${receipt.user_id}`
      );

      const message = messageMap.get(receipt.message_id);
      if (!message || !message.thread_id) {
        console.log(
          `[Chat Notifications] SKIP: No message found or no thread_id. message=${!!message}, thread_id=${message?.thread_id}`
        );
        continue;
      }

      const thread = threadMap.get(message.thread_id);
      console.log(
        `[Chat Notifications] Thread lookup: ${message.thread_id} => is_private=${thread?.is_private}`
      );

      // Skip private threads (only creator can see them, no push to others)
      if (thread?.is_private) {
        console.log(
          `[Chat Notifications] Skipping private thread ${message.thread_id}`
        );
        continue;
      }

      const userId = receipt.user_id;
      const threadId = message.thread_id;

      if (!groupedByUser.has(userId)) {
        groupedByUser.set(userId, new Map());
      }
      const userThreads = groupedByUser.get(userId)!;

      if (!userThreads.has(threadId)) {
        userThreads.set(threadId, []);
      }
      userThreads.get(threadId)!.push({
        receipt_id: receipt.id,
        message_id: message.id,
        content: message.content,
        sender_user_id: message.sender_user_id,
        created_at: message.created_at,
      });
    }

    console.log(
      `[Chat Notifications] ${groupedByUser.size} users with unread messages`
    );

    // Log which users have unread
    for (const [uid, ut] of groupedByUser) {
      console.log(`[Chat Notifications] - User ${uid} has ${ut.size} threads`);
    }

    let notificationsSent = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let skippedDuplicate = 0;
    let skippedNoPushSubs = 0;
    const debugTrace: string[] = [];

    // Step 6: Process each user
    for (const [userId, userThreads] of groupedByUser) {
      debugTrace.push(`PROCESS_USER:${userId}:threads=${userThreads.size}`);
      console.log(
        `[Chat Notifications] === PROCESSING user ${userId} with ${userThreads.size} threads ===`
      );

      // Get user's push subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId)
        .eq("is_active", true);

      debugTrace.push(
        `PUSH_SUBS:count=${subscriptions?.length || 0}:error=${subsError?.message || "none"}`
      );

      console.log(
        `[Chat Notifications] Push subs query: count=${subscriptions?.length || 0}, error=${subsError?.message || "none"}`
      );

      if (subsError) {
        debugTrace.push(`SKIP_SUBS_ERROR`);
        console.error(
          `[Chat Notifications] Error fetching subscriptions for user ${userId}:`,
          subsError
        );
        continue;
      }

      if (!subscriptions || subscriptions.length === 0) {
        debugTrace.push(`SKIP_NO_SUBS`);
        console.log(
          `[Chat Notifications] User ${userId}: No active push subscriptions - SKIPPING`
        );
        skippedNoPushSubs++;
        continue;
      }

      debugTrace.push(`HAS_SUBS:${subscriptions.length}`);
      console.log(
        `[Chat Notifications] User ${userId}: ${subscriptions.length} subscriptions, ${userThreads.size} threads`
      );

      console.log(
        `[Chat Notifications] !!! ABOUT TO ITERATE THREADS for user ${userId} !!!`
      );

      // Process each thread
      let threadIterations = 0;
      for (const [threadId, receipts] of userThreads) {
        threadIterations++;
        debugTrace.push(`THREAD_ITER:${threadId}:receipts=${receipts.length}`);
        console.log(
          `[Chat Notifications] !!! THREAD ITERATION ${threadIterations}: threadId=${threadId}, receipts=${receipts.length} !!!`
        );
        console.log(
          `[Chat Notifications] Processing thread ${threadId} with ${receipts.length} unread`
        );

        const unreadCount = receipts.length;
        const thread = threadMap.get(threadId);

        console.log(`[Chat Notifications] Thread details:`, {
          threadId,
          threadTitle: thread?.title,
          threadFound: !!thread,
        });

        // Sort by created_at to get the last message
        const sortedReceipts = receipts.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastReceipt = sortedReceipts[0];
        const senderProfile = profileMap.get(lastReceipt.sender_user_id);

        console.log(`[Chat Notifications] Last receipt:`, {
          messageId: lastReceipt.message_id,
          senderId: lastReceipt.sender_user_id,
          senderName: senderProfile?.display_name,
        });

        const senderName =
          senderProfile?.display_name ||
          senderProfile?.email?.split("@")[0] ||
          "Someone";
        const threadName = thread?.title || "Chat";

        // Build notification content (WhatsApp style)
        const title =
          unreadCount === 1
            ? `${senderName} • ${threadName}`
            : `${unreadCount} new messages • ${threadName}`;

        const body =
          unreadCount === 1
            ? lastReceipt.content || "(Media)"
            : `${senderName}: ${lastReceipt.content || "(Media)"}`;

        console.log(`[Chat Notifications] Notification content:`, {
          title,
          body,
        });
        // Deduplication: Check if notification already sent for this message
        const groupKey = `chat_${threadId}_${lastReceipt.message_id}`;
        debugTrace.push(`GROUP_KEY:${groupKey}`);

        const { data: existingNotif, error: existingError } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("group_key", groupKey)
          .maybeSingle();

        debugTrace.push(
          `EXISTING_CHECK:found=${!!existingNotif}:error=${existingError?.message || "none"}`
        );

        if (existingNotif) {
          debugTrace.push(`SKIP_DUPLICATE`);
          skippedDuplicate++;
          continue;
        }

        // Create notification in unified table
        const { data: notification, error: insertError } = await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            notification_type: "chat_message",
            title,
            message: body,
            icon: "💬",
            severity: "info",
            source: "cron", // 'chat' not in enum yet, using 'cron' as this is cron-generated
            priority: "normal",
            action_type: "view_details",
            action_url: `/hub?thread=${threadId}`,
            action_data: {
              thread_id: threadId,
              message_count: unreadCount,
              last_message_id: lastReceipt.message_id,
            },
            group_key: groupKey,
            expires_at: new Date(
              now.getTime() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            push_status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          debugTrace.push(`INSERT_ERROR:${insertError.message}`);
          console.error(`Failed to create notification:`, insertError);
          continue;
        }

        debugTrace.push(`INSERT_SUCCESS:id=${notification.id}`);
        notificationsSent++;

        // Send push notification
        const payload = JSON.stringify({
          title,
          body,
          icon: "/appicon-192.png",
          badge: "/appicon-192.png",
          tag: `chat-${threadId}`,
          data: {
            type: "chat_message",
            notification_id: notification.id,
            thread_id: threadId,
            action_url: `/hub?thread=${threadId}`,
            unread_count: unreadCount,
          },
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );

            pushSent++;

            await supabase
              .from("notifications")
              .update({
                push_status: "sent",
                push_sent_at: new Date().toISOString(),
              })
              .eq("id", notification.id);
          } catch (error: unknown) {
            pushFailed++;
            console.error(`Push failed for user ${userId}:`, error);

            const statusCode =
              error && typeof error === "object" && "statusCode" in error
                ? (error as { statusCode: number }).statusCode
                : null;

            // Deactivate invalid subscriptions
            if (statusCode === 404 || statusCode === 410) {
              await supabase
                .from("push_subscriptions")
                .update({ is_active: false })
                .eq("id", sub.id);
            }

            await supabase
              .from("notifications")
              .update({
                push_status: "failed",
                push_error: error instanceof Error ? error.message : "Unknown",
              })
              .eq("id", notification.id);
          }
        }
      }
    }

    // Debug: collect user thread counts
    const userThreadCounts: Record<string, number> = {};
    for (const [uid, threads] of groupedByUser) {
      userThreadCounts[uid] = threads.size;
    }

    return NextResponse.json({
      success: true,
      unread_receipts: unreadReceipts.length,
      users_with_unread: groupedByUser.size,
      user_thread_counts: userThreadCounts,
      notifications_sent: notificationsSent,
      push_sent: pushSent,
      push_failed: pushFailed,
      skipped_duplicate: skippedDuplicate,
      skipped_no_push_subs: skippedNoPushSubs,
      debug_trace: debugTrace,
      checked_at: now.toISOString(),
    });
  } catch (error) {
    console.error("Chat notifications cron error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req);
}
