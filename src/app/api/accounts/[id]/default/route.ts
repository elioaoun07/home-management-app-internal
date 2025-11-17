import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * PATCH /api/accounts/[id]/default
 * Set an account as the default account for the user
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

    // Verify the account belongs to the user
    const { data: account, error: fetchError } = await supabase
      .from("accounts")
      .select("id, user_id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Set this account as default (trigger will handle unsetting others)
    const { error: updateError } = await supabase
      .from("accounts")
      .update({ is_default: true })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error setting default account:", updateError);
      return NextResponse.json(
        { error: "Failed to set default account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Unexpected error in PATCH /api/accounts/[id]/default:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
