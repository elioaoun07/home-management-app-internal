// src/app/api/notifications/snooze/route.ts
// API route to snooze a reminder notification

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
    const { item_id, alert_id, snooze_minutes = 5 } = body;

    if (!item_id || !alert_id) {
      return NextResponse.json(
        { error: "Missing item_id or alert_id" },
        { status: 400 }
      );
    }

    // Calculate snooze until time
    const snoozedUntil = new Date(Date.now() + snooze_minutes * 60 * 1000);

    // Create a snooze record
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
    // This ensures the scheduler picks it up again
    const { error: alertError } = await supabase
      .from("item_alerts")
      .update({
        trigger_at: snoozedUntil.toISOString(),
        last_fired_at: new Date().toISOString(),
      })
      .eq("id", alert_id);

    if (alertError) {
      console.error("Failed to update alert:", alertError);
      // Don't fail - snooze was created
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
