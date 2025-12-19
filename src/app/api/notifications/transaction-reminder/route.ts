// src/app/api/notifications/transaction-reminder/route.ts
// API routes for daily transaction reminder actions (confirm/add-expense)

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
  const { action, notification_id } = body;

  if (action === "confirm") {
    // User clicked "Yes, all done!" - mark notification as complete
    if (notification_id) {
      await supabase
        .from("notifications")
        .update({ action_taken: true, is_dismissed: true, is_read: true })
        .eq("id", notification_id)
        .eq("user_id", user.id);
    }

    // Also mark any daily reminders for today as done
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("notifications")
      .update({ is_read: true, action_taken: true })
      .eq("user_id", user.id)
      .eq("notification_type", "daily_reminder")
      .gte("created_at", `${today}T00:00:00Z`);

    return NextResponse.json({
      success: true,
      message: "Great job keeping your finances up to date! 🎉",
    });
  }

  if (action === "add-expense") {
    // User clicked "Not yet" - just return the redirect URL
    return NextResponse.json({
      success: true,
      redirect: "/expense",
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
