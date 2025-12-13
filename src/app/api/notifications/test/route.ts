// src/app/api/notifications/test/route.ts
// API route to send a test push notification

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

export const dynamic = "force-dynamic";

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "Push notifications not configured - missing VAPID keys" },
      { status: 500 }
    );
  }

  try {
    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (subError) {
      console.error("Failed to get subscriptions:", subError);
      return NextResponse.json(
        { error: "Failed to get subscriptions" },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: "No active push subscriptions found" },
        { status: 404 }
      );
    }

    // Send test notification to all subscriptions
    const payload = JSON.stringify({
      title: "🔔 Test Notification",
      body: "Push notifications are working! You'll receive reminders at their scheduled times.",
      icon: "/appicon-192.png",
      badge: "/appicon-192.png",
      tag: "test-" + Date.now(),
      data: {
        type: "test",
        timestamp: new Date().toISOString(),
      },
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );
          return { success: true, id: sub.id };
        } catch (error: unknown) {
          // If subscription is invalid, mark it as inactive
          const webPushError = error as { statusCode?: number };
          if (
            webPushError.statusCode === 410 ||
            webPushError.statusCode === 404
          ) {
            await supabase
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", sub.id);
          }
          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 }
    );
  }
}
