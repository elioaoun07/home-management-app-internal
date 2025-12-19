/**
 * Sync Notifications (Legacy endpoint - now a no-op)
 *
 * With the unified notifications table, syncing is no longer needed.
 * All notifications (push, in-app, alerts) are stored in the same table.
 *
 * This endpoint is kept for backward compatibility but does nothing.
 */

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No-op - with unified notifications table, no syncing is needed
  // Everything is already in one place
  return NextResponse.json({
    success: true,
    synced: 0,
    message: "Sync not needed - using unified notifications table",
  });
}
