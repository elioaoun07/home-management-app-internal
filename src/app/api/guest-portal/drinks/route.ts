// src/app/api/guest-portal/drinks/route.ts
// Guest drink selections — logged to DB
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Get the drink selection for a session. Public: a guest reads only
// their own row. The host's all-guests view is the authenticated
// /api/guest-portal/admin/orders route (HUB-118).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    const db = supabaseAdmin();

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id required" },
        { status: 400 },
      );
    }

    const { data: drink } = await db
      .from("guest_drinks")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    return NextResponse.json({ drink: drink || null });
  } catch (err) {
    console.error("[GuestDrinks] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Submit or update drink selection
export async function POST(request: NextRequest) {
  try {
    const { tag_id, session_id, guest_name, drink_selection, other_drink } =
      await request.json();

    if (!tag_id || !session_id || !drink_selection) {
      return NextResponse.json(
        { error: "tag_id, session_id, and drink_selection required" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Check if already submitted
    const { data: existing } = await db
      .from("guest_drinks")
      .select("id")
      .eq("session_id", session_id)
      .maybeSingle();

    if (existing) {
      // Update
      const { data: updated, error } = await db
        .from("guest_drinks")
        .update({
          drink_selection,
          other_drink: other_drink || null,
          guest_name: guest_name || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("[GuestDrinks] Update error:", error);
        return NextResponse.json(
          { error: "Failed to update drink selection" },
          { status: 500 },
        );
      }
      return NextResponse.json({ drink: updated, updated: true });
    }

    // Insert new
    const { data: drink, error: insertError } = await db
      .from("guest_drinks")
      .insert({
        tag_id,
        session_id,
        guest_name: guest_name || null,
        drink_selection,
        other_drink: other_drink || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[GuestDrinks] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit drink selection" },
        { status: 500 },
      );
    }

    return NextResponse.json({ drink, created: true });
  } catch (err) {
    console.error("[GuestDrinks] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
