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
      { status: 500 },
    );
  }

  try {
    // Get user's push subscriptions - ORDER BY last_used_at DESC
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, device_name, last_used_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("last_used_at", { ascending: false });

    if (subError) {
      console.error("Failed to get subscriptions:", subError);
      return NextResponse.json(
        { error: "Failed to get subscriptions" },
        { status: 500 },
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: "No active push subscriptions found" },
        { status: 404 },
      );
    }

    // Send test notification to the MOST RECENT subscription only
    const primarySub = subscriptions[0];
    console.log(
      `[Test] Sending to: ${primarySub.device_name} (last used: ${primarySub.last_used_at})`,
    );

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

    try {
      await webpush.sendNotification(
        {
          endpoint: primarySub.endpoint,
          keys: {
            p256dh: primarySub.p256dh,
            auth: primarySub.auth,
          },
        },
        payload,
      );

      // Update last_used_at on success
      await supabase
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", primarySub.id);

      console.log(
        `[Test] ✓ Push sent successfully to ${primarySub.device_name}`,
      );

      return NextResponse.json({
        success: true,
        sent: 1,
        failed: 0,
        total: subscriptions.length,
        device: primarySub.device_name,
      });
    } catch (error: unknown) {
      // If subscription is invalid, mark it as inactive
      const webPushError = error as { statusCode?: number };
      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", primarySub.id);
        console.log(
          `[Test] Marked subscription ${primarySub.id} as inactive (status ${webPushError.statusCode})`,
        );
      }

      console.error(
        `[Test] ✗ Push failed to ${primarySub.device_name}:`,
        error,
      );
      return NextResponse.json(
        {
          error: "Push notification failed",
          details: error instanceof Error ? error.message : "Unknown error",
          statusCode: webPushError.statusCode,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 },
    );
  }
}
