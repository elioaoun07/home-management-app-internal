// src/app/api/catalogue/[id]/disable/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface DisableRequestBody {
  action: "pause" | "delete_future";
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

    const { id: catalogueItemId } = await params;
    const body: DisableRequestBody = await request.json();
    const { action } = body;

    if (!action || !["pause", "delete_future"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'pause' or 'delete_future'" },
        { status: 400 },
      );
    }

    // Get the catalogue item
    const { data: catalogueItem, error: catalogueError } = await supabase
      .from("catalogue_items")
      .select("*, linked_item_id")
      .eq("id", catalogueItemId)
      .eq("user_id", user.id)
      .single();

    if (catalogueError || !catalogueItem) {
      return NextResponse.json(
        { error: "Catalogue item not found" },
        { status: 404 },
      );
    }

    if (!catalogueItem.linked_item_id) {
      return NextResponse.json(
        { error: "Catalogue item is not linked to a calendar item" },
        { status: 400 },
      );
    }

    const linkedItemId = catalogueItem.linked_item_id;

    if (action === "pause") {
      // Pause: Set end_until on recurrence rule to today
      const { error: recurrenceError } = await supabase
        .from("item_recurrence_rules")
        .update({ end_until: new Date().toISOString().split("T")[0] })
        .eq("item_id", linkedItemId);

      if (recurrenceError) {
        console.error("Failed to update recurrence rule:", recurrenceError);
      }

      // Update catalogue item
      const { error: updateError } = await supabase
        .from("catalogue_items")
        .update({
          is_active_on_calendar: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", catalogueItemId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update catalogue item" },
          { status: 500 },
        );
      }

      // Record in history
      await supabase.from("catalogue_item_calendar_history").insert({
        user_id: user.id,
        catalogue_item_id: catalogueItemId,
        item_id: linkedItemId,
        action_type: "paused",
        notes: "Paused from active calendar",
      });

      return NextResponse.json({
        success: true,
        action: "paused",
        item_id: linkedItemId,
      });
    } else if (action === "delete_future") {
      // Delete future: Remove future occurrence actions
      const { error: deleteOccurrencesError } = await supabase
        .from("item_occurrence_actions")
        .delete()
        .eq("item_id", linkedItemId)
        .gt("occurrence_date", new Date().toISOString());

      if (deleteOccurrencesError) {
        console.error(
          "Failed to delete future occurrences:",
          deleteOccurrencesError,
        );
      }

      // Set end_until on recurrence
      const { error: recurrenceError } = await supabase
        .from("item_recurrence_rules")
        .update({ end_until: new Date().toISOString().split("T")[0] })
        .eq("item_id", linkedItemId);

      if (recurrenceError) {
        console.error("Failed to update recurrence rule:", recurrenceError);
      }

      // Update catalogue item
      const { error: updateError } = await supabase
        .from("catalogue_items")
        .update({
          is_active_on_calendar: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", catalogueItemId);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update catalogue item" },
          { status: 500 },
        );
      }

      // Record in history
      await supabase.from("catalogue_item_calendar_history").insert({
        user_id: user.id,
        catalogue_item_id: catalogueItemId,
        item_id: linkedItemId,
        action_type: "removed_from_calendar",
        notes: "Deleted future occurrences",
      });

      return NextResponse.json({
        success: true,
        action: "deleted_future",
        item_id: linkedItemId,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error disabling catalogue item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
