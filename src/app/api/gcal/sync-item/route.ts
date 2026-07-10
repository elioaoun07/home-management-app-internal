// src/app/api/gcal/sync-item/route.ts
// Server-side bridge for the one-way Google Calendar sync. The items
// mutation hooks (src/features/items/useItems.ts) write directly to Supabase
// from the browser when online — they never pass through /api/items/*, so
// the sync calls wired there only fire on offline-queue replay. Each hook
// instead fires this endpoint (best-effort) after a successful write; see
// src/features/items/gcalSync.ts for the client trigger.
//
// action "sync"   — push the item's current state (or remove its event if it
//                   became ineligible: completed/archived/soft-deleted).
// action "delete" — remove the Google event NOW; the client awaits this
//                   BEFORE a hard delete, because once the row is gone the
//                   google_event_id is lost and the event would orphan.

import { isGoogleCalendarConfigured } from "@/lib/gcal/client";
import {
  deleteItemFromGoogleCalendar,
  syncItemToGoogleCalendar,
} from "@/lib/gcal/sync";
import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
// Calls Google synchronously — allow more than the default duration.
export const maxDuration = 30;

const schema = z.object({
  itemId: z.string().uuid(),
  action: z.enum(["sync", "delete"]).default("sync"),
});

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json({ success: true, skipped: "not_configured" });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Both calls are best-effort by design and never throw; access control is
  // the RLS-scoped item fetch inside — items the caller can't read no-op.
  if (parsed.data.action === "delete") {
    await deleteItemFromGoogleCalendar(supabase, parsed.data.itemId);
  } else {
    await syncItemToGoogleCalendar(supabase, parsed.data.itemId);
  }

  return NextResponse.json({ success: true });
}
