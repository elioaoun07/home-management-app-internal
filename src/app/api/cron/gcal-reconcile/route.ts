// src/app/api/cron/gcal-reconcile/route.ts
// Daily reconciliation for the one-way Google Calendar backup sync. Heals
// drift from any item mutation path that didn't go through
// syncItemToGoogleCalendar directly (bulk ops, admin scripts, a failed
// best-effort sync call on a prior request). Two passes per connected user:
//   1. Re-push every currently sync-eligible item (idempotent upsert).
//   2. Delete Google events for items that now have a stale google_event_id
//      but are no longer eligible (completed/cancelled/archived/deleted).
// "How do I know it ran": google_calendar_connections.last_synced_at is
// updated on every successful per-item sync inside syncItemToGoogleCalendar.

import { deleteItemFromGoogleCalendar, syncItemToGoogleCalendar } from "@/lib/gcal/sync";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ITEMS_PER_USER_LIMIT = 200;

function isAuthorized(request: NextRequest): boolean {
  return request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

async function reconcile(): Promise<{ synced: number; cleaned: number; errors: number }> {
  const admin = supabaseAdmin();
  let synced = 0;
  let cleaned = 0;
  let errors = 0;

  const { data: connections } = await admin
    .from("google_calendar_connections")
    .select("user_id")
    .eq("sync_enabled", true);

  for (const connection of connections || []) {
    const { data: eligibleItems } = await admin
      .from("items")
      .select("id")
      .eq("responsible_user_id", connection.user_id)
      .in("type", ["reminder", "event"])
      .is("archived_at", null)
      .is("deleted_at", null)
      .not("status", "in", "(completed,cancelled)")
      .limit(ITEMS_PER_USER_LIMIT);

    for (const item of eligibleItems || []) {
      try {
        await syncItemToGoogleCalendar(admin, item.id);
        synced++;
      } catch {
        errors++;
      }
    }

    const { data: staleItems } = await admin
      .from("items")
      .select("id")
      .eq("responsible_user_id", connection.user_id)
      .not("google_event_id", "is", null)
      .or("archived_at.not.is.null,deleted_at.not.is.null,status.in.(completed,cancelled)")
      .limit(ITEMS_PER_USER_LIMIT);

    for (const item of staleItems || []) {
      try {
        await deleteItemFromGoogleCalendar(admin, item.id);
        cleaned++;
      } catch {
        errors++;
      }
    }
  }

  return { synced, cleaned, errors };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await reconcile();
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
