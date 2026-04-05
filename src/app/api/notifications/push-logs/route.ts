// src/app/api/notifications/push-logs/route.ts
// Returns recent push event logs for the authenticated user.
// Use this to diagnose missed notifications and subscription failures.

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const eventType = url.searchParams.get("event_type") ?? null;

  let query = supabase
    .from("push_event_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also return current subscription state for context
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, device_name, is_active, failed_at, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false });

  return NextResponse.json({
    logs: data ?? [],
    subscriptions: subs ?? [],
    summary: buildSummary(data ?? []),
  });
}

function buildSummary(logs: Array<{ event_type: string; created_at: string; notification_title?: string | null }>) {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    counts[log.event_type] = (counts[log.event_type] ?? 0) + 1;
  }

  const lastFailure410 = logs.find((l) => l.event_type === "send_failure_410");
  const lastSuccess = logs.find((l) => l.event_type === "send_success");
  const lastHealed = logs.find((l) =>
    l.event_type === "sw_token_rotation" || l.event_type === "force_resubscribe" || l.event_type === "health_check_healed"
  );

  return {
    event_counts: counts,
    last_success_at: lastSuccess?.created_at ?? null,
    last_success_title: lastSuccess?.notification_title ?? null,
    last_failure_at: lastFailure410?.created_at ?? null,
    last_healed_at: lastHealed?.created_at ?? null,
  };
}
