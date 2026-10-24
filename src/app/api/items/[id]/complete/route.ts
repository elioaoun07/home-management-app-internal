// src/app/api/items/[id]/complete/route.ts
// Server-side item completion endpoint for service worker quick actions
import { completeItemForUser, type CompleteInput } from "@/lib/items/completeItems";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Use supabaseServer only for authentication; adminDb for all data ops (bypasses RLS)
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: itemId } = await params;
    const body: CompleteInput = await request.json();

    if (!body.occurrence_date) {
      return NextResponse.json(
        { error: "occurrence_date is required" },
        { status: 400 },
      );
    }

    const outcome = await completeItemForUser(
      supabaseAdmin(),
      user.id,
      itemId,
      body,
    );

    if (!outcome.ok) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status },
      );
    }
    if (outcome.type === "occurrence") {
      return NextResponse.json({
        success: true,
        action: outcome.action,
        type: "occurrence",
      });
    }
    return NextResponse.json({
      success: true,
      type: "item",
      itemId: outcome.itemId,
      archived: outcome.archived,
      resetToDormant: outcome.resetToDormant,
    });
  } catch (error) {
    console.error("[item-complete] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
