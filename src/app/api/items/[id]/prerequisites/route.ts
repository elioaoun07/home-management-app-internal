import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const VALID_CONDITION_TYPES = [
  "nfc_state_change",
  "item_completed",
  "weather",
  "time_window",
  "schedule",
  "custom_formula",
] as const;

// GET /api/items/[id]/prerequisites — list prerequisites for an item
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify item ownership
  const { data: item } = await supabase
    .from("items")
    .select("id")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("item_prerequisites")
    .select("*")
    .eq("item_id", itemId)
    .order("logic_group", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/items/[id]/prerequisites — add a prerequisite to an item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify item ownership
  const { data: item } = await supabase
    .from("items")
    .select("id, status")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const schema = z.object({
    condition_type: z.enum(VALID_CONDITION_TYPES),
    condition_config: z.record(z.string(), z.unknown()),
    logic_group: z.number().int().min(0).default(0),
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("item_prerequisites")
    .insert({
      item_id: itemId,
      condition_type: parsed.data.condition_type,
      condition_config: parsed.data.condition_config,
      logic_group: parsed.data.logic_group,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If item was pending/in_progress and now has prerequisites, set to dormant
  if (item.status === "pending" || item.status === "in_progress") {
    await supabase
      .from("items")
      .update({ status: "dormant", updated_at: new Date().toISOString() })
      .eq("id", itemId);
  }

  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/items/[id]/prerequisites — delete a prerequisite by prereq ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prerequisiteId = req.nextUrl.searchParams.get("prerequisiteId");
  if (!prerequisiteId) {
    return NextResponse.json(
      { error: "prerequisiteId query param required" },
      { status: 400 },
    );
  }

  // Verify item ownership
  const { data: item } = await supabase
    .from("items")
    .select("id")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("item_prerequisites")
    .delete()
    .eq("id", prerequisiteId)
    .eq("item_id", itemId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check if any prerequisites remain; if not, activate dormant item
  const { data: remaining } = await supabase
    .from("item_prerequisites")
    .select("id")
    .eq("item_id", itemId)
    .eq("is_active", true)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    // No more prerequisites — move from dormant to pending
    await supabase
      .from("items")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("status", "dormant");
  }

  return NextResponse.json({ success: true });
}
