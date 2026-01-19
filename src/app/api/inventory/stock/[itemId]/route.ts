// src/app/api/inventory/stock/[itemId]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET stock by item ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;

  const { data: stock, error } = await supabase
    .from("inventory_stock")
    .select("*")
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!stock) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(stock);
}

// PATCH - Update stock settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId } = await params;
  const body = await req.json();

  // Only allow updating specific fields
  const allowedFields = [
    "quantity_on_hand",
    "auto_add_to_shopping",
    "shopping_thread_id",
  ];

  const updateData: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const { data: stock, error } = await supabase
    .from("inventory_stock")
    .update(updateData)
    .eq("user_id", user.id)
    .eq("item_id", itemId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(stock);
}
