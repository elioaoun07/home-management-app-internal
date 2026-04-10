// src/app/api/notifications/subscribe/route.ts
// API route to save push subscription to database

import { logPushEvent } from "@/lib/pushLogger";
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

    // Step 0: Check if this exact endpoint was previously deactivated (dead FCM token)
    const { data: existingSub } = await supabase
      .from("push_subscriptions")
      .select("is_active")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .maybeSingle();

    const was_previously_inactive =
      existingSub !== null && !existingSub.is_active;

    if (was_previously_inactive) {
      console.log(
        `[Subscribe] ⚠️ Endpoint was previously deactivated (dead FCM token) — will re-register and tell client to resubscribe`,
      );
    }

    // Step 1: If device_id provided, delete ALL other subscriptions for this device
    // This handles the case where FCM token changed (different endpoint for same device)
    if (device_id) {
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

    // Step 2: Clean up any inactive subscriptions for this user
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("is_active", false);

    // Step 3: Upsert the subscription — always clear failed_at and mark active.
    // The client is actively using the app; trust the fresh subscription.
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
          failed_at: null, // Always clear — fresh subscription from active user
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
      if ((error as any).code === "23505") {
        return NextResponse.json({ error: "Subscription already exists" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 },
      );
    }

    // Count active subscriptions for debugging
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    console.log(
      `[Subscribe] ✓ Subscription saved. User now has ${count} active subscription(s)`,
    );

    const endpointPreview = endpoint.substring(0, 80);
    logPushEvent(supabase, {
      user_id: user.id,
      subscription_id: data.id,
      event_type: "subscribed",
      device_name: device_name ?? null,
      endpoint_preview: endpointPreview,
      metadata: { active_subscriptions: count, was_previously_inactive },
    });

    return NextResponse.json({
      success: true,
      id: data.id,
      active_subscriptions: count,
      was_previously_inactive,
      // Tell client to attempt a fresh resubscribe if this endpoint was dead before
      needs_resubscribe: was_previously_inactive,
    });
  } catch (error) {
    console.error("[Subscribe] Error in subscribe route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

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
