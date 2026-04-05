// src/app/api/notifications/subscribe/route.ts
// API route to save push subscription to database
// ROBUST version: Uses unique device_id for proper stale subscription cleanup

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

    // Step 0: Check if this exact endpoint has problems (inactive OR in failure grace period)
    // Must happen BEFORE step 2 which deletes inactive rows
    const { data: existingSub } = await supabase
      .from("push_subscriptions")
      .select("is_active, failed_at")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .maybeSingle();

    const was_previously_inactive =
      existingSub !== null && !existingSub.is_active;

    // Detect subscriptions in the grace period (is_active=true but failed_at set).
    // These are actively failing but haven't hit the 72h deactivation threshold yet.
    const was_failing =
      existingSub !== null && !!existingSub.is_active && !!existingSub.failed_at;

    if (was_previously_inactive) {
      console.log(
        `[Subscribe] ⚠️ Endpoint was previously marked inactive (dead FCM token) — client will be instructed to re-subscribe`,
      );
    }
    if (was_failing) {
      console.log(
        `[Subscribe] ⚠️ Endpoint is in failure grace period (failed_at=${existingSub!.failed_at}) — preserving failed_at and instructing client to re-subscribe`,
      );
    }

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
          // CRITICAL: Do NOT clear failed_at if the subscription is actively failing.
          // Clearing it resets the 72h grace period timer and creates a destructive loop:
          // cron sets failed_at → foreground sync clears it → cron sets it again → repeat.
          // Instead, keep failed_at intact so the grace period progresses, and tell the
          // client to force-resubscribe for a fresh FCM token.
          failed_at: was_failing ? existingSub!.failed_at : null,
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

    const endpointPreview = endpoint.substring(0, 80);
    if (was_failing || was_previously_inactive) {
      logPushEvent(supabase, {
        user_id: user.id,
        subscription_id: data.id,
        event_type: "subscription_failing",
        device_name: device_name ?? null,
        endpoint_preview: endpointPreview,
        metadata: {
          was_failing,
          was_previously_inactive,
          failed_at: was_failing ? existingSub!.failed_at : null,
        },
      });
    } else {
      logPushEvent(supabase, {
        user_id: user.id,
        subscription_id: data.id,
        event_type: "subscribed",
        device_name: device_name ?? null,
        endpoint_preview: endpointPreview,
        metadata: { active_subscriptions: count },
      });
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      active_subscriptions: count,
      was_previously_inactive,
      // Tell client to force-resubscribe whenever the endpoint is known-bad
      needs_resubscribe: was_failing || was_previously_inactive,
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
