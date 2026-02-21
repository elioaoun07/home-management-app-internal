// src/app/api/guest-portal/session/route.ts
// Creates or retrieves a guest session (unauthenticated)
import { supabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function hashValue(val: string): string {
  return crypto.createHash("sha256").update(val).digest("hex").slice(0, 16);
}

// POST - Create/resume a guest session
export async function POST(request: NextRequest) {
  try {
    const { tag_slug, guest_name, fingerprint, device_id } =
      await request.json();

    if (!tag_slug) {
      return NextResponse.json(
        { error: "tag_slug is required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Find the tag
    const { data: tag, error: tagError } = await db
      .from("guest_portal_tags")
      .select("*")
      .eq("tag_slug", tag_slug)
      .eq("is_active", true)
      .maybeSingle();

    if (tagError || !tag) {
      return NextResponse.json(
        { error: "Portal not found or inactive" },
        { status: 404 },
      );
    }

    // Hash IP for dedup (privacy-friendly)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const ipHash = hashValue(ip);
    const ua = request.headers.get("user-agent") || "unknown";
    const fp = fingerprint || hashValue(ua + ipHash);

    // PRIORITY: Try to find existing active session by device_id first (most unique)
    // This ensures each browser instance gets its own session
    let existingSession = null;

    if (device_id) {
      const { data: sessionByDeviceId } = await db
        .from("guest_sessions")
        .select("*")
        .eq("tag_id", tag.id)
        .eq("device_id", device_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingSession = sessionByDeviceId;
    }

    // FALLBACK: If no device_id match and no device_id provided, try fingerprint
    // (for backward compatibility with old sessions)
    if (!existingSession && !device_id) {
      const { data: sessionByFingerprint } = await db
        .from("guest_sessions")
        .select("*")
        .eq("tag_id", tag.id)
        .eq("fingerprint", fp)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingSession = sessionByFingerprint;
    }

    if (existingSession) {
      // Update last seen, optionally update name, and set device_id if not set
      const updates: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      };
      if (guest_name && guest_name !== existingSession.guest_name) {
        updates.guest_name = guest_name;
      }
      // Migrate old sessions to use device_id
      if (device_id && !existingSession.device_id) {
        updates.device_id = device_id;
      }
      await db
        .from("guest_sessions")
        .update(updates)
        .eq("id", existingSession.id);

      return NextResponse.json({
        session: { ...existingSession, ...updates },
        tag: {
          id: tag.id,
          slug: tag.tag_slug,
          label: tag.label,
          destination: tag.destination,
          wifi_ssid: tag.wifi_ssid,
          // Password delivered only via copy mechanism in the API, never displayed raw
          has_wifi_password: !!tag.wifi_password,
          bio_data: tag.bio_data,
        },
        resumed: true,
      });
    }

    // Create new session with device_id
    const { data: session, error: sessionError } = await db
      .from("guest_sessions")
      .insert({
        tag_id: tag.id,
        guest_name: guest_name || null,
        fingerprint: fp,
        device_id: device_id || null,
        user_agent: ua,
        ip_hash: ipHash,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("[GuestPortal] Session create error:", sessionError);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      session,
      tag: {
        id: tag.id,
        slug: tag.tag_slug,
        label: tag.label,
        destination: tag.destination,
        wifi_ssid: tag.wifi_ssid,
        has_wifi_password: !!tag.wifi_password,
        bio_data: tag.bio_data,
      },
      resumed: false,
    });
  } catch (err) {
    console.error("[GuestPortal] Session error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
