import { adjustAccountBalance } from "@/lib/balance";
import type { AccountType } from "@/lib/balance-utils";
import { getBalanceDelta } from "@/lib/balance-utils";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

    // Fetch old transaction BEFORE update for balance delta calculation
    const { data: oldTx } = await supabase
      .from("transactions")
      .select("amount, account_id, is_draft, is_debt_return")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

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

    // Adjust balance for the update (only for confirmed, non-draft transactions)
    if (oldTx && !oldTx.is_draft && !updated.is_draft) {
      const oldAccountId = oldTx.account_id;
      const newAccountId = updated.account_id;
      const oldAmount = Number(oldTx.amount);
      const newAmount = Number(updated.amount);
      const isDebtReturn = oldTx.is_debt_return || false;

      if (oldAccountId !== newAccountId) {
        // Account changed: reverse from old account, apply to new account
        const { data: oldAcc } = await supabase
          .from("accounts")
          .select("type")
          .eq("id", oldAccountId)
          .single();
        const { data: newAcc } = await supabase
          .from("accounts")
          .select("type")
          .eq("id", newAccountId)
          .single();
        const oldType = (oldAcc?.type || "expense") as AccountType;
        const newType = (newAcc?.type || "expense") as AccountType;

        // Reverse the old transaction from old account
        const reverseDelta = getBalanceDelta(
          oldAmount,
          oldType,
          isDebtReturn,
          "delete",
        );
        await adjustAccountBalance(
          oldAccountId,
          reverseDelta,
          "transaction_moved",
          { userId: user.id, transactionId: id },
        );

        // Apply the new transaction to new account
        const applyDelta = getBalanceDelta(
          newAmount,
          newType,
          isDebtReturn,
          "create",
        );
        await adjustAccountBalance(
          newAccountId,
          applyDelta,
          "transaction_moved",
          { userId: user.id, transactionId: id },
        );
      } else if (oldAmount !== newAmount) {
        // Same account, amount changed: apply the difference
        const { data: acc } = await supabase
          .from("accounts")
          .select("type")
          .eq("id", newAccountId)
          .single();
        const accType = (acc?.type || "expense") as AccountType;
        const oldDelta = getBalanceDelta(
          oldAmount,
          accType,
          isDebtReturn,
          "create",
        );
        const newDelta = getBalanceDelta(
          newAmount,
          accType,
          isDebtReturn,
          "create",
        );
        const diff = newDelta - oldDelta;
        if (diff !== 0) {
          await adjustAccountBalance(
            newAccountId,
            diff,
            "transaction_updated",
            { userId: user.id, transactionId: id },
          );
        }
      }
    }

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
        "account_id, amount, is_draft, split_requested, split_completed_at, collaborator_amount, collaborator_account_id, is_debt_return",
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

    // Get account type for balance delta
    const { data: txAccount } = await supabase
      .from("accounts")
      .select("type")
      .eq("id", transaction.account_id)
      .single();
    const txAccountType = (txAccount?.type || "expense") as AccountType;

    // Use admin client to bypass RLS for cleaning up related records
    const adminClient = supabaseAdmin();

    // 1. Nullify any account_balance_history rows that reference this transaction
    //    (FK constraint has no ON DELETE action, so it would block the delete)
    const { error: abhError } = await adminClient
      .from("account_balance_history")
      .update({ transaction_id: null })
      .eq("transaction_id", id);

    if (abhError) {
      console.error(
        "[Delete Transaction] Error clearing balance history refs:",
        abhError,
      );
    }

    // 2. Nullify hub_feed references
    await adminClient
      .from("hub_feed")
      .update({ transaction_id: null })
      .eq("transaction_id", id);

    // 3. Nullify hub_message_actions references
    await adminClient
      .from("hub_message_actions")
      .update({ transaction_id: null })
      .eq("transaction_id", id);

    // 4. Nullify hub_messages references
    await adminClient
      .from("hub_messages")
      .update({ transaction_id: null })
      .eq("transaction_id", id);

    // 5. Nullify in_app_notifications references
    await adminClient
      .from("in_app_notifications")
      .update({ transaction_id: null })
      .eq("transaction_id", id);

    // 6. Handle child transactions (debt returns linked via parent_transaction_id)
    //    Delete them so they don't remain as orphaned income entries
    const { data: childTransactions } = await adminClient
      .from("transactions")
      .select("id, account_id, amount, is_draft")
      .eq("parent_transaction_id", id);

    if (childTransactions && childTransactions.length > 0) {
      for (const child of childTransactions) {
        // Clear balance history refs for child too
        await adminClient
          .from("account_balance_history")
          .update({ transaction_id: null })
          .eq("transaction_id", child.id);

        // Delete the child transaction
        await adminClient.from("transactions").delete().eq("id", child.id);
        // Balance for child transactions is formula-based - no manual reversal needed
      }

      console.log(
        `[Delete Transaction] Cleaned up ${childTransactions.length} child transaction(s)`,
      );
    }

    // 7. Delete linked debts (ON DELETE CASCADE should handle this,
    //    but let's be explicit to avoid any constraint issues)
    await adminClient.from("debts").delete().eq("transaction_id", id);

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

    // Balance is formula-based - no restoration needed.
    // Deleting the transaction automatically removes it from the formula calculation.
    // The balance will be recomputed on next GET /api/accounts/[id]/balance.

    // Reverse the balance effect of the deleted transaction
    if (!transaction.is_draft) {
      const reverseDelta = getBalanceDelta(
        Number(transaction.amount),
        txAccountType,
        transaction.is_debt_return || false,
        "delete",
      );
      await adjustAccountBalance(
        transaction.account_id,
        reverseDelta,
        "transaction_deleted",
        {
          userId: user.id,
          transactionId: id,
        },
      );

      // If this was a completed split bill, also reverse the collaborator's balance
      if (
        transaction.split_completed_at &&
        transaction.collaborator_account_id &&
        transaction.collaborator_amount
      ) {
        const { data: collabAccount } = await supabase
          .from("accounts")
          .select("type")
          .eq("id", transaction.collaborator_account_id)
          .single();
        const collabType = (collabAccount?.type || "expense") as AccountType;
        const collabReverse = getBalanceDelta(
          Number(transaction.collaborator_amount),
          collabType,
          false,
          "delete",
        );
        await adjustAccountBalance(
          transaction.collaborator_account_id,
          collabReverse,
          "split_deleted",
          {
            userId: user.id,
            transactionId: id,
          },
        );
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
