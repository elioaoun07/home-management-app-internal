// src/app/api/notifications/subscribe/sw/route.ts
// Push subscription update endpoint for service worker use.
//
// Called by the SW's `pushsubscriptionchange` handler when there are no open
// app windows (user can't re-sync via the normal subscribe flow).
//
// Auth: looks up user_id via the old_endpoint value — only a caller that
// already knows the exact old subscription endpoint can update it.
// Uses supabaseAdmin because there is no user session in the SW context.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, p256dh, auth, old_endpoint } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing required subscription data" },
        { status: 400 },
      );
    }

    if (!old_endpoint) {
      return NextResponse.json(
        { error: "old_endpoint required for service worker subscription update" },
        { status: 400 },
      );
    }

    const supabase = supabaseAdmin();

    // Look up the user from the old subscription — this authenticates the request
    const { data: oldSub, error: lookupError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, device_name, user_agent")
      .eq("endpoint", old_endpoint)
      .maybeSingle();

    if (lookupError || !oldSub) {
      console.warn("[SW subscribe] Old endpoint not found:", old_endpoint.substring(0, 50));
      return NextResponse.json(
        { error: "Old subscription not found — cannot authenticate request" },
        { status: 404 },
      );
    }

    const { user_id, device_name, user_agent } = oldSub;

    console.log(
      `[SW subscribe] Token rotation for user ${user_id.substring(0, 8)} — updating subscription`,
    );

    // Mark old subscription inactive
    await supabase
      .from("push_subscriptions")
      .update({ is_active: false })
      .eq("id", oldSub.id);

    // Upsert new subscription (UNIQUE constraint on user_id,endpoint handles duplicates)
    const { error: upsertError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id,
          endpoint,
          p256dh,
          auth,
          device_name: device_name || "Unknown Device",
          user_agent: user_agent || "",
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,endpoint",
          ignoreDuplicates: false,
        },
      );

    if (upsertError) {
      console.error("[SW subscribe] Failed to upsert new subscription:", upsertError);
      return NextResponse.json(
        { error: "Failed to save new subscription" },
        { status: 500 },
      );
    }

    console.log(`[SW subscribe] ✓ Subscription updated for user ${user_id.substring(0, 8)}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SW subscribe] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
