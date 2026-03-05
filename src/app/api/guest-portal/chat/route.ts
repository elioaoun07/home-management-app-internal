// src/app/api/guest-portal/chat/route.ts
// Guest chat messages — logged to DB, notifies host via push
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

// Configure VAPID
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// GET - Fetch chat messages for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const tagId = searchParams.get("tag_id");
    const after = searchParams.get("after"); // ISO timestamp for polling

    if (!sessionId || !tagId) {
      return NextResponse.json(
        { error: "session_id and tag_id required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    let query = db
      .from("guest_chat_messages")
      .select("*")
      .eq("tag_id", tagId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (after) {
      query = query.gt("created_at", after);
    }

    const { data: messages, error } = await query.limit(200);

    if (error) {
      console.error("[GuestChat] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 },
      );
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (err) {
    console.error("[GuestChat] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Send a chat message
export async function POST(request: NextRequest) {
  try {
    const { tag_id, session_id, message, sender, guest_name, metadata } =
      await request.json();

    if (!tag_id || !session_id || !message || !sender) {
      return NextResponse.json(
        { error: "tag_id, session_id, message, and sender required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Verify session
    const { data: session } = await db
      .from("guest_sessions")
      .select("id, tag_id")
      .eq("id", session_id)
      .eq("tag_id", tag_id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    // Insert message
    const { data: msg, error: msgError } = await db
      .from("guest_chat_messages")
      .insert({
        tag_id,
        session_id,
        sender,
        message,
        guest_name: guest_name || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (msgError) {
      console.error("[GuestChat] Insert error:", msgError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 },
      );
    }

    // If guest sent a message, notify the host via push
    if (sender === "guest") {
      try {
        // Get the host user_id from the tag
        const { data: tag } = await db
          .from("guest_portal_tags")
          .select("user_id")
          .eq("id", tag_id)
          .maybeSingle();

        if (tag?.user_id) {
          // Create in-app notification
          await db.from("notifications").insert({
            user_id: tag.user_id,
            title: `🏠 Guest: ${guest_name || "Anonymous"}`,
            message: message.substring(0, 200),
            icon: "message-circle",
            source: "system",
            priority: "normal",
            notification_type: "info",
            severity: "info",
            action_url: "/settings",
          });

          // Send push notification
          const { data: subscriptions } = await db
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", tag.user_id)
            .eq("is_active", true);

          if (subscriptions && subscriptions.length > 0) {
            const payload = JSON.stringify({
              title: `🏠 Guest: ${guest_name || "Anonymous"}`,
              body: message.substring(0, 100),
              icon: "/appicon-192.png",
              badge: "/appicon-192.png",
              tag: `guest-chat-${session_id}`,
              data: {
                type: "guest_chat",
                tag_id,
                session_id,
                url: "/expense?tab=hub&view=alerts",
              },
            });

            for (const sub of subscriptions) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                  },
                  payload,
                );
              } catch (pushError) {
                const e = pushError as { statusCode?: number };
                if (e.statusCode === 410 || e.statusCode === 404) {
                  await db.from("push_subscriptions").delete().eq("id", sub.id);
                }
              }
            }
          }
        }
      } catch (notifErr) {
        // Don't fail the message send if notification fails
        console.error("[GuestChat] Notification error:", notifErr);
      }
    }

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error("[GuestChat] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
