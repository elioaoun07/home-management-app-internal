// src/app/api/inventory/low-stock/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET low stock items
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "7", 10);

  // Calculate the threshold date
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + days);
  const thresholdStr = thresholdDate.toISOString().split("T")[0];

  // Query low stock items using the database function
  const { data, error } = await supabase.rpc("get_low_stock_items", {
    p_user_id: user.id,
    p_days_threshold: days,
  });

  if (error) {
    // Fallback to direct query if function doesn't exist
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("inventory_stock")
      .select(
        `
        item_id,
        quantity_on_hand,
        estimated_runout_date,
        shopping_message_id,
        catalogue_items!inner (
          name,
          metadata_json
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("auto_add_to_shopping", true)
      .not("estimated_runout_date", "is", null)
      .lte("estimated_runout_date", thresholdStr)
      .order("estimated_runout_date", { ascending: true });

    if (fallbackError) {
      return NextResponse.json(
        { error: fallbackError.message },
        { status: 500 },
      );
    }

    // Transform fallback data
    const result = fallbackData.map((item) => {
      const catalogueItem = item.catalogue_items as any;
      const runoutDate = new Date(item.estimated_runout_date!);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilRunout = Math.ceil(
        (runoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        item_id: item.item_id,
        item_name: catalogueItem.name,
        barcode: catalogueItem.metadata_json?.barcode || null,
        quantity_on_hand: item.quantity_on_hand,
        estimated_runout_date: item.estimated_runout_date,
        days_until_runout: daysUntilRunout,
        unit_size: catalogueItem.metadata_json?.unit_size || null,
        already_in_shopping: !!item.shopping_message_id,
      };
    });

    return NextResponse.json(result);
  }

  return NextResponse.json(data || []);
}
