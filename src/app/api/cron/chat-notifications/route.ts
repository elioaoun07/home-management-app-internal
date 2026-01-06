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
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
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
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // Avoid race with immediate push

    // Step 1: Get unread receipts where push failed or was never attempted
    // Skip recently created receipts (< 5 min) to avoid racing with immediate push
    const { data: unreadReceipts, error: receiptsError } = await supabase
      .from("hub_message_receipts")
      .select("id, message_id, user_id, status, push_status")
      .neq("status", "read")
      .lt("created_at", fiveMinutesAgo.toISOString())
      .or("push_status.is.null,push_status.eq.failed,push_status.eq.pending");

    if (receiptsError) {
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

    // Step 2: Get the messages for these receipts
    const messageIds = [...new Set(unreadReceipts.map((r) => r.message_id))];

    const { data: messages, error: messagesError } = await supabase
      .from("hub_messages")
      .select(
        "id, content, sender_user_id, thread_id, created_at, household_id"
      )
      .in("id", messageIds);

    if (messagesError) {
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
      .select("id, title, is_private, created_by, purpose")
      .in("id", threadIds);

    // Create thread lookup map
    const threadMap = new Map(threads?.map((t) => [t.id, t]) || []);

    // Step 4: Get sender profiles
    const senderIds = [
      ...new Set(messages?.map((m) => m.sender_user_id) || []),
    ];

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", senderIds);

    if (profilesError) {
      console.error(
        "[Chat Notifications] Error fetching profiles:",
        profilesError
      );
    }

    console.log("[Chat Notifications] Fetched profiles:", profiles);

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

    for (const receipt of unreadReceipts) {
      const message = messageMap.get(receipt.message_id);
      if (!message || !message.thread_id) continue;

      const thread = threadMap.get(message.thread_id);

      // Skip private threads (only creator can see them, no push to others)
      if (thread?.is_private) continue;

      // Only send push notifications for budget and reminder threads
      if (thread?.purpose !== "budget" && thread?.purpose !== "reminder")
        continue;

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

    let notificationsSent = 0;
    let pushSent = 0;
    let pushFailed = 0;
    let skippedDuplicate = 0;
    let skippedNoPushSubs = 0;

    // Step 6: Process each user
    for (const [userId, userThreads] of groupedByUser) {
      // Get user's push subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (subsError) continue;

      if (!subscriptions || subscriptions.length === 0) {
        skippedNoPushSubs++;
        continue;
      }

      // Process each thread
      for (const [threadId, receipts] of userThreads) {
        const unreadCount = receipts.length;
        const thread = threadMap.get(threadId);

        // Sort by created_at to get the last message
        const sortedReceipts = receipts.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastReceipt = sortedReceipts[0];
        const senderProfile = profileMap.get(lastReceipt.sender_user_id);

        console.log("[Chat Notifications] Sender lookup:", {
          sender_user_id: lastReceipt.sender_user_id,
          profile: senderProfile,
          profileMapSize: profileMap.size,
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

        // Deduplication: Check if notification already sent for this message
        const groupKey = `chat_${threadId}_${lastReceipt.message_id}`;

        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("group_key", groupKey)
          .maybeSingle();

        if (existingNotif) {
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

            // Also update the receipts' push_status so we don't retry
            const receiptIds = receipts.map((r) => r.receipt_id);
            await supabase
              .from("hub_message_receipts")
              .update({
                push_status: "sent",
                push_sent_at: new Date().toISOString(),
              })
              .in("id", receiptIds);
          } catch (error: unknown) {
            pushFailed++;

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

            // Also mark receipts as failed so we can retry later or stop retrying
            const receiptIds = receipts.map((r) => r.receipt_id);
            await supabase
              .from("hub_message_receipts")
              .update({
                push_status: "failed",
                push_sent_at: new Date().toISOString(),
                push_error: error instanceof Error ? error.message : "Unknown",
              })
              .in("id", receiptIds);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      unread_receipts: unreadReceipts.length,
      users_with_unread: groupedByUser.size,
      notifications_sent: notificationsSent,
      push_sent: pushSent,
      push_failed: pushFailed,
      skipped_duplicate: skippedDuplicate,
      skipped_no_push_subs: skippedNoPushSubs,
      checked_at: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req);
}
