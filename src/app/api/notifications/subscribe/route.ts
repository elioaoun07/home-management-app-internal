// src/app/api/notifications/subscribe/route.ts
// API route to save push subscription to database

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
    const body = await req.json();
    const { endpoint, p256dh, auth, device_name, user_agent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing required subscription data" },
        { status: 400 },
      );
    }

    // First, delete all old subscriptions for this user on same device type
    // This prevents accumulation of stale subscriptions when endpoint changes (common on Android PWAs)
    const deviceType = getDeviceType(user_agent || "");

    // Delete existing subscriptions for this user that match the device type
    // Keep only the most recent one (the one we're about to upsert)
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("device_name", deviceType)
      .neq("endpoint", endpoint); // Don't delete if it's the same endpoint we're upserting

    if (deleteError) {
      console.log(
        "[Subscribe] Note: Could not clean up old subscriptions:",
        deleteError.message,
      );
      // Continue anyway - this is not critical
    }

    // Upsert the subscription (update if exists, create if not)
    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          device_name: deviceType,
          user_agent,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,endpoint",
          ignoreDuplicates: false,
        },
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to save push subscription:", error);
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Error in subscribe route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Helper to identify device type from user agent
function getDeviceType(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) return "Android Phone";
    return "Android Tablet";
  }
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown Device";
}
