// src/app/api/guest-portal/wifi/route.ts
// Securely copies WiFi password to clipboard (returns password for copy only)
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST - Get WiFi password for copy
export async function POST(request: NextRequest) {
  try {
    const { tag_id, session_id } = await request.json();

    if (!tag_id || !session_id) {
      return NextResponse.json(
        { error: "tag_id and session_id required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Verify session is valid
    const { data: session } = await db
      .from("guest_sessions")
      .select("id")
      .eq("id", session_id)
      .eq("tag_id", tag_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 403 });
    }

    // Get WiFi password
    const { data: tag } = await db
      .from("guest_portal_tags")
      .select("wifi_password")
      .eq("id", tag_id)
      .maybeSingle();

    if (!tag?.wifi_password) {
      return NextResponse.json(
        { error: "WiFi not configured" },
        { status: 404 },
      );
    }

    // Return password (client will copy to clipboard, never display it)
    return NextResponse.json({ password: tag.wifi_password });
  } catch (err) {
    console.error("[GuestPortal] WiFi error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
