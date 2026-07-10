// src/app/api/gcal/connection/route.ts
// Connection status (for the Preferences toggle) + disconnect.

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("sync_enabled, last_synced_at, sync_error, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ connection: connection ?? null });
}

export async function PATCH(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (typeof body.sync_enabled !== "boolean") {
    return NextResponse.json({ error: "sync_enabled must be a boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .update({ sync_enabled: body.sync_enabled, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Note: this only removes the connection — it deliberately does not walk
  // every item clearing google_event_id/deleting Google-side events. The
  // events simply stop receiving updates (still one-way, still harmless);
  // reconnecting later resumes sync for anything still eligible.
  return NextResponse.json({ success: true });
}
