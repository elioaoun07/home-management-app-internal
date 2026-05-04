// src/app/api/items/[id]/route.ts
// API route for updating and deleting items
// Used by offline sync engine for replay

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
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
    const body = await request.json();

    // Verify item exists
    const { data: existing, error: fetchError } = await supabase
      .from("items")
      .select("id, user_id")
      .eq("id", itemId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Extract update fields (only allow known fields)
    const allowedFields = [
      "title",
      "description",
      "priority",
      "status",
      "metadata_json",
      "is_public",
      "responsible_user_id",
      "notify_all_household",
      "categories",
      "location_context",
      "location_text",
      "archived_at",
      "pinned",
    ];
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from("items")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("[items/[id]] Failed to update item:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update type-specific details if provided
    if (body.due_at !== undefined || body.estimate_minutes !== undefined) {
      const detailUpdate: Record<string, unknown> = {};
      if (body.due_at !== undefined) detailUpdate.due_at = body.due_at;
      if (body.estimate_minutes !== undefined)
        detailUpdate.estimate_minutes = body.estimate_minutes;

      await supabase
        .from("reminder_details")
        .update(detailUpdate)
        .eq("item_id", itemId);
    }

    if (body.start_at !== undefined || body.end_at !== undefined) {
      const eventUpdate: Record<string, unknown> = {};
      if (body.start_at !== undefined) eventUpdate.start_at = body.start_at;
      if (body.end_at !== undefined) eventUpdate.end_at = body.end_at;
      if (body.all_day !== undefined) eventUpdate.all_day = body.all_day;
      if (body.location_text !== undefined)
        eventUpdate.location_text = body.location_text;

      await supabase
        .from("event_details")
        .update(eventUpdate)
        .eq("item_id", itemId);
    }

    // Cascade: if due_at or start_at changed, recompute relative alerts and
    // reset absolute alerts to the new anchor time.
    const newAnchor = body.start_at !== undefined ? body.start_at : body.due_at;
    if (newAnchor !== undefined && newAnchor !== null) {
      const { data: alerts } = await supabase
        .from("item_alerts")
        .select("id, kind, offset_minutes, relative_to")
        .eq("item_id", itemId)
        .eq("active", true);
      if (alerts?.length) {
        const baseTime = new Date(newAnchor as string);
        for (const a of alerts) {
          let newTrigger: string;
          if (a.kind === "relative" && a.offset_minutes != null) {
            const baseForThis =
              a.relative_to === "end" && body.end_at
                ? new Date(body.end_at as string)
                : baseTime;
            newTrigger = new Date(
              baseForThis.getTime() - a.offset_minutes * 60 * 1000,
            ).toISOString();
          } else {
            newTrigger = baseTime.toISOString();
          }
          await supabase
            .from("item_alerts")
            .update({ trigger_at: newTrigger, last_fired_at: null })
            .eq("id", a.id);
        }
      }
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("[items/[id]] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    // Check if archive or hard delete (query param ?archive=true)
    const { searchParams } = new URL(request.url);
    const shouldArchive = searchParams.get("archive") === "true";

    if (shouldArchive) {
      const { error } = await supabase
        .from("items")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", itemId);

      if (error) {
        console.error("[items/[id]] Failed to archive item:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Soft-delete (Recycle Bin). Item is recoverable for 30 days.
      const { error } = await supabase
        .from("items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", itemId);

      if (error) {
        console.error("[items/[id]] Failed to delete item:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      action: shouldArchive ? "archived" : "deleted",
    });
  } catch (error) {
    console.error("[items/[id]] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
