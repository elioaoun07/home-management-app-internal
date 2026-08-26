import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/accounts/[id]/default-income
 * Set an account as the user's default INCOME account — the account
 * Statement Import lands a received person-transfer in, independent of the
 * app-wide default account (see /api/accounts/[id]/default).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: accountId } = await params;

    const { data: account, error: fetchError } = await supabase
      .from("accounts")
      .select("id, user_id, type")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (account.type !== "income") {
      return NextResponse.json(
        { error: "Only an income account can be the default income account" },
        { status: 400 }
      );
    }

    // Set this account as the default income account (trigger unsets others).
    const { error: updateError } = await supabase
      .from("accounts")
      .update({ is_default_income: true })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error setting default income account:", updateError);
      return NextResponse.json(
        { error: "Failed to set default income account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Unexpected error in PATCH /api/accounts/[id]/default-income:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
