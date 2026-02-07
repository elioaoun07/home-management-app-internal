// src/app/api/guest-portal/allergies/route.ts
// Guest allergy submissions — logged to DB
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Check if allergy already submitted for this session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    const { data: allergy } = await db
      .from("guest_allergies")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    return NextResponse.json({ allergy: allergy || null });
  } catch (err) {
    console.error("[GuestAllergies] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Submit or update allergies
export async function POST(request: NextRequest) {
  try {
    const { tag_id, session_id, guest_name, allergies } = await request.json();

    if (!tag_id || !session_id || !allergies) {
      return NextResponse.json(
        { error: "tag_id, session_id, and allergies required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Check if already submitted
    const { data: existing } = await db
      .from("guest_allergies")
      .select("id")
      .eq("session_id", session_id)
      .maybeSingle();

    if (existing) {
      // Update
      const { data: updated, error } = await db
        .from("guest_allergies")
        .update({
          allergies,
          guest_name: guest_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to update allergies" },
          { status: 500 },
        );
      }
      return NextResponse.json({ allergy: updated, updated: true });
    }

    // Insert new
    const { data: allergy, error: insertError } = await db
      .from("guest_allergies")
      .insert({
        tag_id,
        session_id,
        guest_name: guest_name || null,
        allergies,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[GuestAllergies] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit allergies" },
        { status: 500 },
      );
    }

    return NextResponse.json({ allergy, updated: false });
  } catch (err) {
    console.error("[GuestAllergies] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
