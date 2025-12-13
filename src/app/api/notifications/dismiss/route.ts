// src/app/api/notifications/dismiss/route.ts
// API route to mark a notification as dismissed

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
    const { notification_log_id, item_id, alert_id } = body;

    // Update notification log if provided
    if (notification_log_id) {
      const { error } = await supabase
        .from("notification_logs")
        .update({
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
        })
        .eq("id", notification_log_id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to update notification log:", error);
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
