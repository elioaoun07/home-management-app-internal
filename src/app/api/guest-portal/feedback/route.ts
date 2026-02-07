// src/app/api/guest-portal/feedback/route.ts
// Anonymous guest feedback — no session link for true anonymity
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST - Submit anonymous feedback
export async function POST(request: NextRequest) {
  try {
    const { tag_id, feedback_type, message } = await request.json();

    if (!tag_id || !feedback_type || !message) {
      return NextResponse.json(
        { error: "tag_id, feedback_type, and message required" },
        { status: 400 },
      );
    }

    if (!["suggestion", "complaint"].includes(feedback_type)) {
      return NextResponse.json(
        { error: "feedback_type must be suggestion or complaint" },
        { status: 400 },
      );
    }

    const db = supabaseAdmin();

    // Verify tag exists
    const { data: tag } = await db
      .from("guest_portal_tags")
      .select("id")
      .eq("id", tag_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!tag) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const { error } = await db.from("guest_feedback").insert({
      tag_id,
      feedback_type,
      message,
    });

    if (error) {
      console.error("[GuestFeedback] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to submit feedback" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[GuestFeedback] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
