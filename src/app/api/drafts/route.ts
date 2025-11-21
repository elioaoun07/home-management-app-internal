import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch draft transactions for the current user
export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch drafts with account and category names
    const { data: drafts, error } = await supabase
      .from("transactions")
      .select(
        `
        id,
        date,
        amount,
        description,
        category_id,
        subcategory_id,
        voice_transcript,
        confidence_score,
        inserted_at,
        account_id,
        accounts!inner(name),
        category:user_categories!transactions_category_fk(name, icon),
        subcategory:user_categories!transactions_subcategory_fk(name)
      `
      )
      .eq("user_id", user.id)
      .eq("is_draft", true)
      .order("inserted_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ drafts: drafts || [] });
  } catch (error: any) {
    console.error("Error fetching drafts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}

// POST - Create a new draft transaction
export async function POST(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      account_id,
      amount,
      category_id,
      subcategory_id,
      description,
      voice_transcript,
      confidence_score,
      date,
    } = body;

    if (!account_id || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: account_id, amount" },
        { status: 400 }
      );
    }

    const { data: draft, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id,
        amount: parseFloat(amount),
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        description: description || "",
        voice_transcript: voice_transcript || null,
        confidence_score: confidence_score || null,
        date: date || new Date().toISOString().split("T")[0],
        is_draft: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating draft:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create draft" },
      { status: 500 }
    );
  }
}
