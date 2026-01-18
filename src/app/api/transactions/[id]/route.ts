import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BalanceChangeType =
  | "transaction_expense"
  | "transaction_deleted"
  | "transfer_in"
  | "transfer_out"
  | "initial_set"
  | "manual_set"
  | "manual_adjustment"
  | "reconciliation"
  | "correction";

/**
 * Helper to log balance history entry
 * Note: Transaction entries (expense/income) are now shown via daily summaries,
 * so we only log non-transaction changes here. transaction_deleted is still logged
 * as it's an important audit event.
 */
async function logBalanceHistory(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  previousBalance: number,
  newBalance: number,
  changeAmount: number,
  changeType: BalanceChangeType,
  transactionId?: string,
  effectiveDate?: string,
): Promise<void> {
  // Skip logging individual transaction expense/income entries - they're shown via daily summaries
  // But DO log transaction_deleted as it's an important balance correction event
  if (changeType === "transaction_expense") {
    return;
  }

  try {
    await supabase.from("account_balance_history").insert({
      account_id: accountId,
      user_id: userId,
      previous_balance: previousBalance,
      new_balance: newBalance,
      change_amount: changeAmount,
      change_type: changeType,
      transaction_id: transactionId || null,
      transfer_id: null,
      effective_date: effectiveDate || new Date().toISOString().split("T")[0],
    });
  } catch (e) {
    console.error("Failed to log balance history:", e);
  }
}

// GET - Fetch a single transaction by ID
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    // Fetch the transaction - either owned by user or shared via household
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select(
        `
        *,
        category:user_categories!transactions_category_id_fkey(id, name, color),
        subcategory:user_categories!transactions_subcategory_id_fkey(id, name, color),
        account:accounts!transactions_account_id_fkey(id, name)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Check if user has access (owner or household member)
    const isOwner = transaction.user_id === user.id;

    if (!isOwner) {
      // Check if user is in the same household
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("household_id")
        .eq("id", user.id)
        .single();

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("household_id")
        .eq("id", transaction.user_id)
        .single();

      const sameHousehold =
        userProfile?.household_id &&
        userProfile.household_id === ownerProfile?.household_id;

      if (!sameHousehold) {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 },
        );
      }
    }

    // Format response
    return NextResponse.json({
      transaction: {
        id: transaction.id,
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description,
        account_id: transaction.account_id,
        account_name: transaction.account?.name || null,
        category: transaction.category?.name || null,
        category_id: transaction.category_id,
        subcategory: transaction.subcategory?.name || null,
        subcategory_id: transaction.subcategory_id,
        inserted_at: transaction.inserted_at,
        user_id: transaction.user_id,
        is_owner: isOwner,
        split_requested: transaction.split_requested,
        split_completed_at: transaction.split_completed_at,
      },
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
        { status: 400 },
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
        { status: 500 },
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Fetch category and subcategory names for complete response
    let categoryName: string | null = null;
    let categoryColor: string | null = null;
    let subcategoryName: string | null = null;
    let subcategoryColor: string | null = null;
    let accountName: string | null = null;

    if (updated.category_id) {
      const { data: categoryData } = await supabase
        .from("user_categories")
        .select("name, color")
        .eq("id", updated.category_id)
        .single();
      if (categoryData) {
        categoryName = categoryData.name;
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

    // Return complete transaction object (icon derived from category name via getCategoryIcon)
    return NextResponse.json({
      ...updated,
      category: categoryName,
      subcategory: subcategoryName,
      account_name: accountName,
      category_color: categoryColor || "#38bdf8",
      subcategory_color: subcategoryColor || "#38bdf8",
      is_owner: true,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    // First, get the transaction to check if it's a draft, split bill, and account info
    const { data: transaction, error: fetchError } = await supabase
      .from("transactions")
      .select(
        "account_id, amount, is_draft, split_requested, split_completed_at, collaborator_amount, collaborator_account_id",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
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
        { status: 500 },
      );
    }

    // Restore account balances for confirmed (non-draft) transactions
    if (!transaction.is_draft) {
      console.log("[Delete Transaction] Restoring balances for transaction:", {
        transaction_id: id,
        owner_account_id: transaction.account_id,
        owner_amount: transaction.amount,
        is_split: transaction.split_requested,
        split_completed: !!transaction.split_completed_at,
        collab_account_id: transaction.collaborator_account_id,
        collab_amount: transaction.collaborator_amount,
      });

      const effectiveDate = new Date().toISOString().split("T")[0];

      // Restore owner's account balance (add back the transaction amount)
      const { data: ownerBalance, error: ownerFetchError } = await supabase
        .from("account_balances")
        .select("balance")
        .eq("account_id", transaction.account_id)
        .single();

      if (ownerFetchError) {
        console.error(
          "[Delete Transaction] Error fetching owner balance:",
          ownerFetchError,
        );
      } else if (ownerBalance) {
        const previousBalance = Number(ownerBalance.balance);
        const restoredOwnerBalance =
          previousBalance + Number(transaction.amount);
        console.log("[Delete Transaction] Restoring owner balance:", {
          current: ownerBalance.balance,
          amount_to_add: transaction.amount,
          new_balance: restoredOwnerBalance,
        });

        const { error: updateError } = await supabase
          .from("account_balances")
          .update({
            balance: restoredOwnerBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", transaction.account_id);

        if (updateError) {
          console.error(
            "[Delete Transaction] Error updating owner balance:",
            updateError,
          );
        } else {
          // Log balance history for deletion
          await logBalanceHistory(
            supabase,
            transaction.account_id,
            user.id,
            previousBalance,
            restoredOwnerBalance,
            Number(transaction.amount),
            "transaction_deleted",
            id,
            effectiveDate,
          );
        }
      }

      // If this was a completed split bill, also restore collaborator's balance
      if (
        transaction.split_requested &&
        transaction.split_completed_at &&
        transaction.collaborator_amount &&
        transaction.collaborator_account_id
      ) {
        console.log(
          "[Delete Transaction] This is a completed split bill, restoring collaborator balance",
        );

        // Use admin client to bypass RLS when updating collaborator's balance
        // (owner doesn't have permission to update partner's account_balances)
        const adminClient = supabaseAdmin();

        const { data: collabBalance, error: collabFetchError } =
          await adminClient
            .from("account_balances")
            .select("balance")
            .eq("account_id", transaction.collaborator_account_id)
            .single();

        if (collabFetchError) {
          console.error(
            "[Delete Transaction] Error fetching collaborator balance:",
            collabFetchError,
          );
        } else if (collabBalance) {
          const restoredCollabBalance =
            Number(collabBalance.balance) +
            Number(transaction.collaborator_amount);
          console.log("[Delete Transaction] Restoring collaborator balance:", {
            current: collabBalance.balance,
            amount_to_add: transaction.collaborator_amount,
            new_balance: restoredCollabBalance,
          });

          const { error: updateError } = await adminClient
            .from("account_balances")
            .update({
              balance: restoredCollabBalance,
              updated_at: new Date().toISOString(),
            })
            .eq("account_id", transaction.collaborator_account_id);

          if (updateError) {
            console.error(
              "[Delete Transaction] Error updating collaborator balance:",
              updateError,
            );
          } else {
            console.log(
              "[Delete Transaction] Successfully restored collaborator balance",
            );
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
