// src/app/api/merchant-mappings/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET all merchant mappings for the user
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from("merchant_mappings")
      .select("*")
      .eq("user_id", user.id)
      .order("use_count", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Failed to fetch merchant mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch merchant mappings" },
      { status: 500 }
    );
  }
}

// POST - create or update a merchant mapping
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      merchant_pattern,
      merchant_name,
      category_id,
      subcategory_id,
      account_id,
    } = body;

    if (!merchant_pattern || !merchant_name) {
      return NextResponse.json(
        { error: "merchant_pattern and merchant_name are required" },
        { status: 400 }
      );
    }

    // Upsert - if pattern exists, update it; otherwise create new
    const { data, error } = await supabase
      .from("merchant_mappings")
      .upsert(
        {
          user_id: user.id,
          merchant_pattern: merchant_pattern.toUpperCase().trim(),
          merchant_name: merchant_name.trim(),
          category_id: category_id || null,
          subcategory_id: subcategory_id || null,
          account_id: account_id || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,merchant_pattern",
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to save merchant mapping:", error);
    return NextResponse.json(
      { error: "Failed to save merchant mapping" },
      { status: 500 }
    );
  }
}

// DELETE - remove a merchant mapping
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("merchant_mappings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete merchant mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete merchant mapping" },
      { status: 500 }
    );
  }
}
