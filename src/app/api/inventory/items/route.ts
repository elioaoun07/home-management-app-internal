// src/app/api/inventory/items/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET inventory items with stock info
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the inventory module for this user
  const { data: inventoryModule } = await supabase
    .from("catalogue_modules")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "inventory")
    .single();

  if (!inventoryModule) {
    // Return empty if no inventory module exists
    return NextResponse.json([]);
  }

  // Get all items in inventory module with their stock info
  const { data: items, error } = await supabase
    .from("catalogue_items")
    .select(
      `
      id,
      name,
      description,
      category_id,
      metadata_json,
      created_at,
      updated_at,
      inventory_stock (
        id,
        quantity_on_hand,
        last_restocked_at,
        last_restocked_quantity,
        estimated_runout_date,
        auto_add_to_shopping,
        shopping_thread_id,
        shopping_message_id,
        last_added_to_shopping_at,
        created_at,
        updated_at
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("module_id", inventoryModule.id)
    .is("archived_at", null)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform to InventoryItemWithStock format
  const result = items.map((item) => {
    const stock = item.inventory_stock?.[0] || null;
    const metadata = item.metadata_json || {};
    const consumptionDays = metadata.consumption_rate_days || 0;

    // Calculate days until runout
    let daysUntilRunout: number | null = null;
    if (stock?.estimated_runout_date) {
      const runoutDate = new Date(stock.estimated_runout_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysUntilRunout = Math.ceil(
        (runoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // Determine stock status
    let stockStatus: "ok" | "low" | "critical" | "out" = "ok";
    const qty = stock?.quantity_on_hand ?? 0;
    const minStock = metadata.minimum_stock ?? 1;

    if (qty <= 0) {
      stockStatus = "out";
    } else if (daysUntilRunout !== null && daysUntilRunout <= 3) {
      stockStatus = "critical";
    } else if (daysUntilRunout !== null && daysUntilRunout <= 7) {
      stockStatus = "low";
    } else if (qty <= minStock) {
      stockStatus = "low";
    }

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category_id: item.category_id,
      metadata: metadata,
      stock: stock
        ? {
            id: stock.id,
            user_id: user.id,
            item_id: item.id,
            quantity_on_hand: stock.quantity_on_hand,
            last_restocked_at: stock.last_restocked_at,
            last_restocked_quantity: stock.last_restocked_quantity,
            estimated_runout_date: stock.estimated_runout_date,
            auto_add_to_shopping: stock.auto_add_to_shopping,
            shopping_thread_id: stock.shopping_thread_id,
            shopping_message_id: stock.shopping_message_id,
            last_added_to_shopping_at: stock.last_added_to_shopping_at,
            created_at: stock.created_at,
            updated_at: stock.updated_at,
          }
        : null,
      days_until_runout: daysUntilRunout,
      stock_status: stockStatus,
    };
  });

  return NextResponse.json(result);
}

// POST - Create new inventory item
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    module_id,
    category_id,
    name,
    description,
    barcode,
    unit_type,
    unit_size,
    unit_value,
    unit_measure,
    consumption_rate_days,
    minimum_stock = 1,
    typical_purchase_quantity = 1,
    preferred_store,
    notes,
    initial_quantity = 0,
  } = body;

  if (!name || !unit_size || !consumption_rate_days) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: name, unit_size, consumption_rate_days",
      },
      { status: 400 },
    );
  }

  // Build metadata
  const metadata = {
    barcode: barcode || null,
    unit_type: unit_type || "pack",
    unit_size,
    unit_value: unit_value || null,
    unit_measure: unit_measure || null,
    consumption_rate_days,
    minimum_stock,
    typical_purchase_quantity,
    preferred_store: preferred_store || null,
    notes: notes || null,
  };

  // Create the catalogue item
  const { data: item, error: itemError } = await supabase
    .from("catalogue_items")
    .insert({
      user_id: user.id,
      module_id,
      category_id: category_id || null,
      name,
      description: description || null,
      status: "active",
      priority: "normal",
      metadata_json: metadata,
    })
    .select()
    .single();

  if (itemError) {
    return NextResponse.json({ error: itemError.message }, { status: 500 });
  }

  // Create initial stock record
  const { data: stock, error: stockError } = await supabase
    .from("inventory_stock")
    .insert({
      user_id: user.id,
      item_id: item.id,
      quantity_on_hand: initial_quantity,
      last_restocked_at: new Date().toISOString(),
      last_restocked_quantity: initial_quantity > 0 ? initial_quantity : null,
      auto_add_to_shopping: true,
    })
    .select()
    .single();

  if (stockError) {
    // Rollback item creation on stock error
    await supabase.from("catalogue_items").delete().eq("id", item.id);
    return NextResponse.json({ error: stockError.message }, { status: 500 });
  }

  // If initial quantity > 0, add to restock history
  if (initial_quantity > 0) {
    await supabase.from("inventory_restock_history").insert({
      user_id: user.id,
      stock_id: stock.id,
      item_id: item.id,
      quantity_added: initial_quantity,
      quantity_before: 0,
      quantity_after: initial_quantity,
      source: "manual",
    });
  }

  return NextResponse.json({ item, stock });
}
