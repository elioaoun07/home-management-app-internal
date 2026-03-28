// src/app/api/notifications/test/route.ts
// API route to send a test push notification to ALL active subscriptions

import { sendPushToUser } from "@/lib/pushSender";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    const result = await sendPushToUser(supabase, user.id, payload);

    if (result.sent === 0 && result.deactivated.length === 0 && result.failed === 0) {
      return NextResponse.json(
        { error: "No active push subscriptions found" },
        { status: 404 },
      );
    }

    const allGone = result.sent === 0 && result.failed === 0 && result.deactivated.length > 0;

    return NextResponse.json(
      {
        success: result.sent > 0,
        sent: result.sent,
        failed: result.failed,
        deactivated: result.deactivated.length,
        suggestion: allGone
          ? "All subscriptions were expired. Please disable and re-enable notifications to refresh."
          : result.sent === 0
            ? "Push delivery failed. Try disabling and re-enabling notifications."
            : null,
      },
      { status: result.sent > 0 ? 200 : 500 },
    );
  } catch (error) {
    console.error("[test] Error sending test notification:", error);
    return NextResponse.json(
      { error: "Failed to send test notification" },
      { status: 500 },
    );
  }
}
