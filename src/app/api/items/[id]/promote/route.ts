// src/app/api/items/[id]/promote/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface PromoteRequestBody {
  module_id: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  keep_linked?: boolean;
  // Task-specific fields
  item_type?: "reminder" | "event" | "task";
  location_context?: "home" | "outside" | "anywhere" | null;
  location_url?: string | null;
  preferred_time?: string | null;
  preferred_duration_minutes?: number | null;
  recurrence_pattern?: string | null;
  recurrence_days_of_week?: number[];
  subtasks_text?: string | null;
  priority?: string;
  tags?: string[];
  is_flexible_routine?: boolean;
  flexible_period?: string | null;
  item_category_ids?: string[];
  is_public?: boolean;
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
    const body: PromoteRequestBody = await request.json();
    const {
      module_id,
      category_id,
      name,
      description,
      keep_linked = true,
      // Task-specific fields
      item_type,
      location_context,
      location_url,
      preferred_time,
      preferred_duration_minutes,
      recurrence_pattern,
      recurrence_days_of_week = [],
      subtasks_text,
      priority = "normal",
      tags = [],
      is_flexible_routine = false,
      flexible_period,
      item_category_ids = [],
      is_public = false,
    } = body;

    // Validate required fields
    if (!module_id || !name?.trim()) {
      return NextResponse.json(
        { error: "Module ID and name are required" },
        { status: 400 },
      );
    }

    // Get the item to promote
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select(
        `
        *,
        reminder_details(*),
        event_details(*),
        item_recurrence_rules(*)
      `,
      )
      .eq("id", itemId)
      .eq("user_id", user.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if already linked to a catalogue item
    if (item.source_catalogue_item_id) {
      return NextResponse.json(
        { error: "Item is already linked to a catalogue template" },
        { status: 400 },
      );
    }

    // Create the catalogue item with all fields from the form
    const { data: catalogueItem, error: catalogueError } = await supabase
      .from("catalogue_items")
      .insert({
        user_id: user.id,
        module_id,
        category_id: category_id || null,
        name: name.trim(),
        description: description?.trim() || null,
        item_type: item_type || item.type,
        priority,
        is_active_on_calendar: keep_linked,
        linked_item_id: keep_linked ? itemId : null,
        // Location
        location_context: location_context || null,
        location_url: location_url || null,
        // Time preferences
        preferred_time: preferred_time || null,
        preferred_duration_minutes: preferred_duration_minutes || null,
        // Recurrence
        recurrence_pattern: recurrence_pattern || null,
        recurrence_days_of_week:
          recurrence_days_of_week.length > 0 ? recurrence_days_of_week : [],
        // Subtasks
        subtasks_text: subtasks_text || null,
        // Flexible routine
        is_flexible_routine,
        flexible_period: is_flexible_routine ? flexible_period : null,
        // Tags and categories
        tags: tags.length > 0 ? tags : [],
        item_category_ids:
          item_category_ids.length > 0 ? item_category_ids : [],
        // Visibility
        is_public,
      })
      .select()
      .single();

    if (catalogueError) {
      console.error("Failed to create catalogue item:", catalogueError);
      return NextResponse.json(
        { error: "Failed to create catalogue template" },
        { status: 500 },
      );
    }

    // If keeping linked, update the item with the reverse link
    if (keep_linked) {
      const { error: updateError } = await supabase
        .from("items")
        .update({
          source_catalogue_item_id: catalogueItem.id,
          is_template_instance: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (updateError) {
        console.error("Failed to update item with reverse link:", updateError);
        // Don't fail the whole operation, the catalogue item was created successfully
      }
    }

    // Record in history
    await supabase.from("catalogue_item_calendar_history").insert({
      user_id: user.id,
      catalogue_item_id: catalogueItem.id,
      item_id: itemId,
      action_type: "added_to_calendar",
      notes: `Promoted from existing calendar item`,
    });

    return NextResponse.json({
      success: true,
      catalogue_item_id: catalogueItem.id,
      linked: keep_linked,
    });
  } catch (error) {
    console.error("Error promoting item to catalogue:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
