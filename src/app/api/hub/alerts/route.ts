import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Alert types that show in Hub > Alerts (subset of notification_type)
const HUB_ALERT_TYPES = [
  "daily_reminder",
  "budget_warning",
  "budget_exceeded",
  "bill_due",
  "bill_overdue",
  "goal_milestone",
  "goal_completed",
  "transaction_pending",
  "warning",
  "error",
];

// GET - Fetch alerts for user (from unified notifications table)
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Fetch alerts from notifications table (filtered by alert-type notifications)
  const { data: alerts, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_dismissed", false)
    .in("notification_type", HUB_ALERT_TYPES)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: alerts || [] });
}

// PATCH - Mark alert as read/dismissed/actioned
export async function PATCH(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, is_read, is_dismissed, action_taken, snoozed_until } = body;

  if (!id) {
    return NextResponse.json({ error: "Alert ID required" }, { status: 400 });
  }

  const updates: Record<string, boolean | string | null> = {};
  if (is_read !== undefined) updates.is_read = is_read;
  if (is_dismissed !== undefined) updates.is_dismissed = is_dismissed;
  if (action_taken !== undefined) updates.action_taken = action_taken;
  if (snoozed_until !== undefined) updates.snoozed_until = snoozed_until;

  const { error } = await supabase
    .from("notifications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
