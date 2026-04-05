// src/app/api/notifications/subscription-health/route.ts
// Lightweight endpoint for the service worker's Periodic Background Sync handler.
//
// The SW has no auth session in background context, so it authenticates via the
// subscription endpoint URL (a secret only the legitimate subscriber knows).
// Uses supabaseAdmin — same pattern as /api/notifications/subscribe/sw.
//
// Returns { needs_resubscribe: true } when the subscription has failed_at set,
// signalling the SW to force a fresh FCM token rotation.

import { logPushEvent } from "@/lib/pushLogger";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data: sub, error } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, is_active, failed_at")
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (error) {
      console.error("[subscription-health] DB error:", error.message);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    const endpointPreview = endpoint.substring(0, 80);

    if (!sub) {
      // Endpoint not in DB — cleaned up or never registered
      logPushEvent(supabase, {
        event_type: "health_check_failing",
        endpoint_preview: endpointPreview,
        metadata: { reason: "not_found" },
      });
      return NextResponse.json({ needs_resubscribe: true, reason: "not_found" });
    }

    if (!sub.is_active) {
      logPushEvent(supabase, {
        user_id: sub.user_id,
        subscription_id: sub.id,
        event_type: "health_check_failing",
        endpoint_preview: endpointPreview,
        metadata: { reason: "inactive" },
      });
      return NextResponse.json({ needs_resubscribe: true, reason: "inactive" });
    }

    if (sub.failed_at) {
      logPushEvent(supabase, {
        user_id: sub.user_id,
        subscription_id: sub.id,
        event_type: "health_check_failing",
        endpoint_preview: endpointPreview,
        metadata: { reason: "failing", failed_at: sub.failed_at },
      });
      return NextResponse.json({ needs_resubscribe: true, reason: "failing", failed_at: sub.failed_at });
    }

    logPushEvent(supabase, {
      user_id: sub.user_id,
      subscription_id: sub.id,
      event_type: "health_check_ok",
      endpoint_preview: endpointPreview,
    });
    return NextResponse.json({ needs_resubscribe: false });
  } catch (err) {
    console.error("[subscription-health] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
