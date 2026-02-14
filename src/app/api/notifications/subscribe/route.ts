// src/app/api/notifications/subscribe/route.ts
// API route to save push subscription to database
// ROBUST version: Uses unique device_id for proper stale subscription cleanup

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
    const { endpoint, p256dh, auth, device_id, device_name, user_agent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing required subscription data" },
        { status: 400 },
      );
    }

    console.log(
      `[Subscribe] Processing subscription for user ${user.id.substring(0, 8)}...`,
    );
    console.log(`[Subscribe] Device ID: ${device_id || "not provided"}`);
    console.log(`[Subscribe] Device Name: ${device_name}`);
    console.log(`[Subscribe] Endpoint: ${endpoint.substring(0, 60)}...`);

    // Step 1: If device_id provided, delete ALL other subscriptions for this device
    // This is the KEY fix - device_id is unique per browser installation
    if (device_id) {
      // Delete any subscription with matching device_id but different endpoint
      // This handles the case where FCM token changed
      const { data: deletedByDeviceId, error: deleteError } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .ilike("device_name", `%${device_id.substring(0, 8)}%`)
        .neq("endpoint", endpoint)
        .select("id, endpoint");

      if (deletedByDeviceId && deletedByDeviceId.length > 0) {
        console.log(
          `[Subscribe] ✓ Cleaned up ${deletedByDeviceId.length} stale subscription(s) for this device`,
        );
      }
      if (deleteError) {
        console.log(
          "[Subscribe] Note: Could not clean up by device_id:",
          deleteError.message,
        );
      }
    }

    // Step 2: Also clean up any inactive subscriptions for this user
    const { error: inactiveDeleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("is_active", false);

    if (inactiveDeleteError) {
      console.log(
        "[Subscribe] Note: Could not clean up inactive subscriptions:",
        inactiveDeleteError.message,
      );
    }

    // Step 3: Upsert the subscription (update if exists, create if not)
    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          device_name: device_name || getDeviceType(user_agent || ""),
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
      console.error("[Subscribe] Failed to save push subscription:", error);
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 },
      );
    }

    // Step 4: Count active subscriptions for this user (for debugging)
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    console.log(
      `[Subscribe] ✓ Subscription saved. User now has ${count} active subscription(s)`,
    );

    return NextResponse.json({
      success: true,
      id: data.id,
      active_subscriptions: count,
    });
  } catch (error) {
    console.error("[Subscribe] Error in subscribe route:", error);
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
