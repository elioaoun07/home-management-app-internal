// src/app/api/inventory/add-to-shopping/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST - Add low stock items to shopping list
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { item_ids, thread_id } = body;

  if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
    return NextResponse.json(
      { error: "Missing required field: item_ids (array)" },
      { status: 400 },
    );
  }

  if (!thread_id) {
    return NextResponse.json(
      { error: "Missing required field: thread_id" },
      { status: 400 },
    );
  }

  // Get item details
  const { data: items, error: itemsError } = await supabase
    .from("catalogue_items")
    .select("id, name, metadata_json")
    .eq("user_id", user.id)
    .in("id", item_ids);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Get the thread's household_id
  const { data: thread, error: threadError } = await supabase
    .from("hub_chat_threads")
    .select("household_id")
    .eq("id", thread_id)
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  let addedCount = 0;

  for (const item of items || []) {
    const metadata = item.metadata_json || {};
    const unitSize = metadata.unit_size || "";
    const content = unitSize ? `${item.name} (${unitSize})` : item.name;

    // Create the shopping message
    const { data: message, error: msgError } = await supabase
      .from("hub_messages")
      .insert({
        household_id: thread.household_id,
        thread_id,
        sender_user_id: user.id,
        message_type: "text",
        content,
        source: "inventory",
        source_item_id: item.id,
        item_quantity: metadata.typical_purchase_quantity
          ? `${metadata.typical_purchase_quantity}`
          : null,
      })
      .select("id")
      .single();

    if (!msgError && message) {
      // Update the inventory_stock to track that this was added
      await supabase
        .from("inventory_stock")
        .update({
          shopping_message_id: message.id,
          shopping_thread_id: thread_id,
          last_added_to_shopping_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("item_id", item.id);

      addedCount++;
    }
  }

  return NextResponse.json({ added: addedCount });
}
