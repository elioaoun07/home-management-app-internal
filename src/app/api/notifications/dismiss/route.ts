// src/app/api/notifications/dismiss/route.ts
// DEPRECATED: Use /api/notifications/actions with action: "dismiss" instead
// This route is kept for backwards compatibility

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    // Support both old and new field names
    const notification_id = body.notification_id || body.notification_log_id;
    const { item_id, alert_id } = body;

    // Update notification in the unified table
    if (notification_id) {
      const { error } = await supabase
        .from("notifications")
        .update({
          dismissed_at: new Date().toISOString(),
          action_taken: true,
        })
        .eq("id", notification_id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to dismiss notification:", error);
      }
    }

    // If alert_id provided, mark the alert as fired
    if (alert_id) {
      const { error } = await supabase
        .from("item_alerts")
        .update({
          last_fired_at: new Date().toISOString(),
        })
        .eq("id", alert_id);

      if (error) {
        console.error("Failed to update alert:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in dismiss route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
