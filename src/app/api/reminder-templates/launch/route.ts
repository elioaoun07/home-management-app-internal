import { supabaseServer } from "@/lib/supabase/server";
import { addMinutes, isValid, parse } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper function to parse date string with multiple format attempts
function parseDateTime(dateStr: string): Date | null {
  // Try parsing as ISO string first
  let date = new Date(dateStr);
  if (isValid(date)) return date;

  // Try parsing common formats
  const formats = [
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm",
    "yyyy-MM-dd HH:mm:ss",
    "yyyy-MM-dd HH:mm",
  ];

  for (const fmt of formats) {
    try {
      date = parse(dateStr, fmt, new Date());
      if (isValid(date)) return date;
    } catch {
      // Continue to next format
    }
  }

  return null;
}

// POST - Launch a reminder template (create an item from it)
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { template_id, start_at, duration_minutes } = body;

  if (!template_id || !start_at) {
    return NextResponse.json(
      { error: "template_id and start_at are required" },
      { status: 400 }
    );
  }

  // Parse and validate the start date
  const startDate = parseDateTime(start_at);
  if (!startDate) {
    return NextResponse.json(
      {
        error: `Invalid start_at date format: "${start_at}". Expected format like 2024-12-08T19:00:00`,
      },
      { status: 400 }
    );
  }

  // Fetch the template
  const { data: template, error: templateError } = await supabase
    .from("reminder_templates")
    .select("*")
    .eq("id", template_id)
    .eq("user_id", user.id)
    .single();

  if (templateError || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Calculate duration
  const durationMins =
    duration_minutes || template.default_duration_minutes || 60;
  const endDate = addMinutes(startDate, durationMins);

  // Create the item based on template type
  const itemType = template.item_type || "task";

  // Create base item
  const { data: item, error: itemError } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      type: itemType,
      title: template.title,
      description: template.description,
      priority: template.priority || "normal",
      status: "pending",
      is_public: false,
      responsible_user_id: user.id,
    })
    .select()
    .single();

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  // Create type-specific details
  if (itemType === "reminder" || itemType === "task") {
    const { error: detailsError } = await supabase
      .from("reminder_details")
      .insert({
        item_id: item.id,
        due_at: startDate.toISOString(),
        estimate_minutes: durationMins,
        has_checklist: false,
      });

    if (detailsError) {
      // Clean up the item if details fail
      await supabase.from("items").delete().eq("id", item.id);
      return NextResponse.json(
        { error: detailsError.message },
        { status: 500 }
      );
    }
  } else if (itemType === "event") {
    const { error: detailsError } = await supabase
      .from("event_details")
      .insert({
        item_id: item.id,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        all_day: false,
        location_text: template.location_text,
      });

    if (detailsError) {
      // Clean up the item if details fail
      await supabase.from("items").delete().eq("id", item.id);
      return NextResponse.json(
        { error: detailsError.message },
        { status: 500 }
      );
    }
  }

  // Update template use count
  await supabase
    .from("reminder_templates")
    .update({
      use_count: (template.use_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", template_id);

  // Fetch the complete item with details
  const { data: completeItem, error: fetchError } = await supabase
    .from("items")
    .select(
      `
      *,
      reminder_details (*),
      event_details (*)
    `
    )
    .eq("id", item.id)
    .single();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json(completeItem, { status: 201 });
}
