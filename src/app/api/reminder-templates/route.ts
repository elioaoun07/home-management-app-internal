import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch all reminder templates for the current user
export async function GET(_req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("reminder_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("use_count", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// POST - Create a new reminder template
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name,
    title,
    description,
    priority,
    item_type,
    default_duration_minutes,
    default_start_time,
    location_text,
    icon,
    color,
  } = body;

  // Validate required fields
  if (!name || !title) {
    return NextResponse.json(
      { error: "Name and title are required" },
      { status: 400 }
    );
  }

  // Validate item_type if provided
  const validTypes = ["reminder", "event", "task"];
  if (item_type && !validTypes.includes(item_type)) {
    return NextResponse.json(
      { error: "Invalid item_type. Must be 'reminder', 'event', or 'task'" },
      { status: 400 }
    );
  }

  // Validate priority if provided
  const validPriorities = ["low", "normal", "high", "urgent"];
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reminder_templates")
    .insert({
      user_id: user.id,
      name,
      title,
      description: description || null,
      priority: priority || "normal",
      item_type: item_type || "task",
      default_duration_minutes: default_duration_minutes || null,
      default_start_time: default_start_time || null,
      location_text: location_text || null,
      icon: icon || "clipboard-list",
      color: color || "#38bdf8",
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

// PUT - Update an existing reminder template
export async function PUT(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Template ID is required" },
      { status: 400 }
    );
  }

  // Remove undefined values
  const cleanUpdates: Record<string, unknown> = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  });

  const { data, error } = await supabase
    .from("reminder_templates")
    .update(cleanUpdates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

// DELETE - Delete a reminder template
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Template ID is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("reminder_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
