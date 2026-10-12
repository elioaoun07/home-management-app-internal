import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

import { prerequisiteSchema, sourceFailure } from "@/lib/items/createContract";

const completionSchema = z.object({ completion: z.object({ status: z.literal("complete"), itemId: z.uuid(), itemStatus: z.string() }) });

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

  if (!z.uuid().safeParse(itemId).success) return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  const parsed = prerequisiteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const { data, error } = await supabase.rpc("add_item_prerequisite_complete", { p_item_id: itemId, p: parsed.data });
    if (error) return NextResponse.json({ error: "Trigger was not verified", completion: sourceFailure(error.code) },
      { status: error.code === "P0002" ? 404 : error.code === "42501" ? 403 : error.code === "23505" ? 409 : 500 });
    if (!completionSchema.safeParse(data).success)
      return NextResponse.json({ error: "Trigger unverified. Check Schedule before retrying.", completion: { status: "unknown" } }, { status: 502 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Trigger unverified. Check Schedule before retrying.", completion: { status: "unknown" } }, { status: 500 });
  }
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

  if (!z.uuid().safeParse(itemId).success || !z.uuid().safeParse(prerequisiteId).success)
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const { data, error } = await supabase.rpc("remove_item_prerequisite_complete", { p_item_id: itemId, p_prerequisite_id: prerequisiteId });
    if (error) return NextResponse.json({ error: "Removal was not verified", completion: sourceFailure(error.code) },
      { status: error.code === "P0002" ? 404 : error.code === "42501" ? 403 : 500 });
    if (!completionSchema.safeParse(data).success)
      return NextResponse.json({ error: "Removal unverified. Check Schedule.", completion: { status: "unknown" } }, { status: 502 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Removal unverified. Check Schedule.", completion: { status: "unknown" } }, { status: 500 });
  }
}
