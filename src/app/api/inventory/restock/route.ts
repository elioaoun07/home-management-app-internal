// src/app/api/inventory/restock/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST - Restock an inventory item
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { item_id, quantity, source = "manual" } = body;

  if (!item_id || quantity === undefined || quantity <= 0) {
    return NextResponse.json(
      { error: "Missing required fields: item_id, quantity (positive number)" },
      { status: 400 },
    );
  }

  // Get current stock
  const { data: currentStock } = await supabase
    .from("inventory_stock")
    .select("*")
    .eq("user_id", user.id)
    .eq("item_id", item_id)
    .single();

  const quantityBefore = currentStock?.quantity_on_hand ?? 0;
  const quantityAfter = quantityBefore + quantity;

  let stock;

  if (currentStock) {
    // Update existing stock
    const { data: updatedStock, error } = await supabase
      .from("inventory_stock")
      .update({
        quantity_on_hand: quantityAfter,
        last_restocked_at: new Date().toISOString(),
        last_restocked_quantity: quantity,
        // Clear shopping references since we've restocked
        shopping_message_id: null,
        last_added_to_shopping_at: null,
      })
      .eq("id", currentStock.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    stock = updatedStock;
  } else {
    // Create new stock record
    const { data: newStock, error } = await supabase
      .from("inventory_stock")
      .insert({
        user_id: user.id,
        item_id,
        quantity_on_hand: quantity,
        last_restocked_at: new Date().toISOString(),
        last_restocked_quantity: quantity,
        auto_add_to_shopping: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    stock = newStock;
  }

  // Record in history
  await supabase.from("inventory_restock_history").insert({
    user_id: user.id,
    stock_id: stock.id,
    item_id,
    quantity_added: quantity,
    quantity_before: quantityBefore,
    quantity_after: quantityAfter,
    source,
  });

  return NextResponse.json(stock);
}
