// src/app/api/notifications/transaction-reminder/route.ts
// API routes for daily transaction reminder actions (confirm/add-expense)
// Settings are managed via the general /api/notifications/preferences endpoint

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST: Handle reminder actions (confirm or add-expense)
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, alert_id } = body;

  if (action === "confirm") {
    // User clicked "Yes, all done!" - mark alert as complete
    if (alert_id) {
      await supabase
        .from("hub_alerts")
        .update({ action_taken: true, is_dismissed: true })
        .eq("id", alert_id)
        .eq("user_id", user.id);
    }

    // Also mark any in_app_notifications for today as read
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("in_app_notifications")
      .update({ is_read: true, action_taken: true })
      .eq("user_id", user.id)
      .like("group_key", `daily_transaction_reminder_${today}%`);

    return NextResponse.json({
      success: true,
      message: "Great job keeping your finances up to date! 🎉",
    });
  }

  if (action === "add-expense") {
    // User clicked "Not yet" - just return the redirect URL
    // The alert stays visible until they confirm
    return NextResponse.json({
      success: true,
      redirect: "/dashboard?action=add-expense",
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
