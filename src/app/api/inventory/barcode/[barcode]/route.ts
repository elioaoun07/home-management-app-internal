// src/app/api/inventory/barcode/[barcode]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET item by barcode
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ barcode: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { barcode } = await params;

  if (!barcode) {
    return NextResponse.json({ error: "Barcode required" }, { status: 400 });
  }

  // Try to find item by barcode in metadata_json
  const { data: item, error } = await supabase
    .from("catalogue_items")
    .select("*")
    .eq("user_id", user.id)
    .filter("metadata_json->>barcode", "eq", barcode)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}
