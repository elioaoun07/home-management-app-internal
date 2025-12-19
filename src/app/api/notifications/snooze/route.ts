// src/app/api/notifications/snooze/route.ts
// API route to snooze a notification

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
    const { notification_id, item_id, alert_id, snooze_minutes = 5 } = body;

    // Calculate snooze until time
    const snoozedUntil = new Date(Date.now() + snooze_minutes * 60 * 1000);

    // If notification_id is provided, snooze the notification directly
    if (notification_id) {
      const { error } = await supabase
        .from("notifications")
        .update({ snoozed_until: snoozedUntil.toISOString() })
        .eq("id", notification_id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to snooze notification:", error);
        return NextResponse.json(
          { error: "Failed to snooze" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        snoozed_until: snoozedUntil.toISOString(),
      });
    }

    // Legacy: handle item_id and alert_id for item_alerts
    if (!item_id || !alert_id) {
      return NextResponse.json(
        { error: "Missing notification_id or (item_id and alert_id)" },
        { status: 400 }
      );
    }

    // Create a snooze record for item_alerts
    const { data: snooze, error: snoozeError } = await supabase
      .from("item_snoozes")
      .insert({
        alert_id,
        item_id,
        snoozed_until: snoozedUntil.toISOString(),
      })
      .select()
      .single();

    if (snoozeError) {
      console.error("Failed to create snooze:", snoozeError);
      return NextResponse.json(
        { error: "Failed to snooze notification" },
        { status: 500 }
      );
    }

    // Update the alert's trigger_at to the snooze time
    const { error: alertError } = await supabase
      .from("item_alerts")
      .update({
        trigger_at: snoozedUntil.toISOString(),
        last_fired_at: new Date().toISOString(),
      })
      .eq("id", alert_id);

    if (alertError) {
      console.error("Failed to update alert:", alertError);
    }

    return NextResponse.json({
      success: true,
      snoozed_until: snoozedUntil.toISOString(),
      snooze_id: snooze.id,
    });
  } catch (error) {
    console.error("Error in snooze route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
