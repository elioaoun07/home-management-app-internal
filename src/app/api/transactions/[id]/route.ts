import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    // Extract updateable fields
    const {
      date,
      amount,
      description,
      category_id,
      subcategory_id,
      account_id,
    } = body;

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (date !== undefined) updateData.date = date;
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (subcategory_id !== undefined)
      updateData.subcategory_id = subcategory_id;
    if (account_id !== undefined) updateData.account_id = account_id;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update the transaction
    const { data: updated, error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating transaction:", error);
      return NextResponse.json(
        { error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Fetch category and subcategory names for complete response
    let categoryName: string | null = null;
    let categoryIcon: string | null = null;
    let categoryColor: string | null = null;
    let subcategoryName: string | null = null;
    let subcategoryColor: string | null = null;
    let accountName: string | null = null;

    if (updated.category_id) {
      const { data: categoryData } = await supabase
        .from("user_categories")
        .select("name, icon, color")
        .eq("id", updated.category_id)
        .single();
      if (categoryData) {
        categoryName = categoryData.name;
        categoryIcon = categoryData.icon;
        categoryColor = categoryData.color;
      }
    }

    if (updated.subcategory_id) {
      const { data: subcategoryData } = await supabase
        .from("user_categories")
        .select("name, color")
        .eq("id", updated.subcategory_id)
        .single();
      if (subcategoryData) {
        subcategoryName = subcategoryData.name;
        subcategoryColor = subcategoryData.color;
      }
    }

    if (updated.account_id) {
      const { data: accountData } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", updated.account_id)
        .single();
      if (accountData) {
        accountName = accountData.name;
      }
    }

    // Update account_balances.updated_at
    await supabase
      .from("account_balances")
      .update({ updated_at: new Date().toISOString() })
      .eq("account_id", updated.account_id);

    // Return complete transaction object
    return NextResponse.json({
      ...updated,
      category: categoryName,
      subcategory: subcategoryName,
      account_name: accountName,
      category_icon: categoryIcon || "📝",
      category_color: categoryColor || "#38bdf8",
      subcategory_color: subcategoryColor || "#38bdf8",
      is_owner: true,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // First, get the transaction to check if it's a draft and get account_id
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select("account_id, is_draft")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Delete the transaction
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting transaction:", error);
      return NextResponse.json(
        { error: "Failed to delete transaction" },
        { status: 500 }
      );
    }

    // Update account_balances.updated_at only for confirmed (non-draft) transactions
    if (!transaction.is_draft) {
      await supabase
        .from("account_balances")
        .update({ updated_at: new Date().toISOString() })
        .eq("account_id", transaction.account_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
