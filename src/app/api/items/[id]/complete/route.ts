// src/app/api/items/[id]/complete/route.ts
// Server-side item completion endpoint for service worker quick actions
import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface CompleteRequestBody {
  occurrence_date: string; // ISO date string (YYYY-MM-DD)
  is_recurring: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: itemId } = await params;
    const body: CompleteRequestBody = await request.json();
    const { occurrence_date, is_recurring } = body;

    if (!occurrence_date) {
      return NextResponse.json(
        { error: "occurrence_date is required" },
        { status: 400 },
      );
    }

    // Verify item exists and belongs to user (or their household)
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id, user_id, status, type")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (is_recurring) {
      // For recurring items: record completion of this occurrence
      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .insert({
          item_id: itemId,
          occurrence_date,
          action_type: "completed",
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error(
          "[item-complete] Failed to complete recurring item:",
          error,
        );
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: data,
        type: "occurrence",
      });
    } else {
      // For non-recurring: determine if should be archived
      const occurrenceDateObj = new Date(occurrence_date);
      const now = new Date();
      const weekStart = new Date(now);
      const dayOfWeek = now.getDay();
      const daysFromMonday = (dayOfWeek + 6) % 7;
      weekStart.setDate(now.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);

      const shouldArchive = occurrenceDateObj < weekStart;

      const updatePayload: Record<string, string> = {
        status: "completed",
        updated_at: new Date().toISOString(),
      };

      if (shouldArchive) {
        updatePayload.archived_at = new Date().toISOString();
      }

      // Update item status + record action in parallel
      const [itemResult, actionResult] = await Promise.all([
        supabase.from("items").update(updatePayload).eq("id", itemId),
        supabase.from("item_occurrence_actions").insert({
          item_id: itemId,
          occurrence_date,
          action_type: "completed",
          created_by: user.id,
        }),
      ]);

      if (itemResult.error) {
        console.error(
          "[item-complete] Failed to update item:",
          itemResult.error,
        );
        return NextResponse.json(
          { error: itemResult.error.message },
          { status: 500 },
        );
      }

      // Also update reminder_details if it exists
      await supabase
        .from("reminder_details")
        .update({ completed_at: new Date().toISOString() })
        .eq("item_id", itemId);

      return NextResponse.json({
        success: true,
        type: "item",
        itemId,
        archived: shouldArchive,
      });
    }
  } catch (error) {
    console.error("[item-complete] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
