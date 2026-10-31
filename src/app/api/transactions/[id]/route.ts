import { getAccessibleAccount, getActiveHouseholdPartnerId } from "@/lib/accountAccess";
import { adjustAccountBalance } from "@/lib/balance";
import type { AccountType } from "@/lib/balance-utils";
import { getBalanceDelta } from "@/lib/balance-utils";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { canAccessTrip } from "@/lib/tripAccess";
import { canRemoveSplit } from "@/lib/utils/splitBill";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const splitUpdateSchema = z.object({
  split_requested: z.boolean(),
  // Undo may restore only the same, still-active household partner.
  collaborator_id: z.string().uuid().optional(),
}).strict();

type SplitUpdate = z.infer<typeof splitUpdateSchema>;

async function updateSplit(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  id: string,
  input: SplitUpdate,
) {
  const { data: transaction, error: readError } = await supabase
    .from("transactions").select("*")
    .eq("id", id).eq("user_id", userId).is("deleted_at", null).maybeSingle();
  if (readError) return NextResponse.json({ error: "Failed to read transaction" }, { status: 500 });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (transaction.split_completed_at || transaction.is_draft) {
    return NextResponse.json({ error: "Split cannot be changed" }, { status: 409 });
  }
  if (!input.split_requested && transaction.split_requested && !canRemoveSplit(transaction)) {
    return NextResponse.json({ error: "Split cannot be removed" }, { status: 409 });
  }

  let collaboratorId = transaction.collaborator_id as string | null;
  if (!input.split_requested && !collaboratorId && input.collaborator_id) {
    // A retry after the row saved but notification dismissal failed still has
    // the original recipient. Authorize it again rather than accepting a UUID.
    const partnerId = await getActiveHouseholdPartnerId(supabase, userId);
    if (input.collaborator_id !== partnerId) {
      return NextResponse.json({ error: "Split partner changed" }, { status: 409 });
    }
    collaboratorId = partnerId;
  }
  if (input.split_requested) {
    const partnerId = await getActiveHouseholdPartnerId(supabase, userId);
    if (!partnerId || (input.collaborator_id && input.collaborator_id !== partnerId) ||
      (transaction.split_requested && collaboratorId !== partnerId)) {
      return NextResponse.json({ error: "Split requires the active household partner" }, { status: 409 });
    }
    collaboratorId = partnerId;
  }

  // Split metadata only: never enter the amount/account balance update path.
  // The predicate is checked again by the DB after a concurrent completion.
  const update = supabase.from("transactions")
    .update({
      split_requested: input.split_requested,
      collaborator_id: input.split_requested ? collaboratorId : null,
      collaborator_amount: null,
      collaborator_description: null,
      collaborator_account_id: null,
    })
    .eq("id", id).eq("user_id", userId).is("deleted_at", null)
    .is("split_completed_at", null);
  const { data: updated, error } = await (transaction.split_requested == null
    ? update.is("split_requested", null)
    : update.eq("split_requested", transaction.split_requested))
    .select().maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to update split" }, { status: error.code === "23505" ? 409 : 500 });
  if (!updated) return NextResponse.json({ error: "Split changed; reopen the transaction" }, { status: 409 });

  // The recipient owns these notifications. Narrow admin authority to the
  // authenticated owner's transaction and its verified collaborator only.
  if (collaboratorId) {
    const admin = supabaseAdmin();
    let notificationError;
    if (!input.split_requested) {
      ({ error: notificationError } = await admin.from("notifications")
        .update({ is_dismissed: true, action_taken: true })
        .eq("transaction_id", id).eq("user_id", collaboratorId)
        .eq("notification_type", "transaction_pending"));
    } else {
      // Reuse an old request (including its full-bill hint) for retries/Undo.
      const { data: existing, error: lookupError } = await admin.from("notifications")
        .select("id").eq("transaction_id", id).eq("user_id", collaboratorId)
        .eq("notification_type", "transaction_pending")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      notificationError = lookupError;
      if (!lookupError && existing) {
        ({ error: notificationError } = await admin.from("notifications")
          .update({ is_dismissed: false, action_taken: false, is_read: false })
          .eq("id", existing.id).eq("user_id", collaboratorId).eq("transaction_id", id));
      } else if (!lookupError) {
        ({ error: notificationError } = await admin.from("notifications").insert({
          user_id: collaboratorId,
          title: "Split Bill Request",
          message: "Add your portion",
          icon: "split",
          notification_type: "transaction_pending",
          severity: "action",
          source: "transaction",
          priority: "high",
          action_type: "log_transaction",
          transaction_id: id,
          action_data: {
            transaction_id: id,
            owner_amount: updated.amount,
            owner_description: updated.description,
          },
        }));
      }
    }
    if (notificationError) {
      return NextResponse.json({ error: "Split saved; notification update failed", transaction: updated }, { status: 502 });
    }
  }
  return NextResponse.json({ ...updated, is_owner: true });
}

type TransactionUpdateData = {
  date?: string;
  amount?: number;
  description?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  account_id?: string;
  /** Optional trip tag — independent of account_id, never affects balance. */
  trip_id?: string | null;
};

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
        account:accounts!transactions_account_id_fkey(id, name, user_id, is_public)
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

    // Check if user has access (owner or via a public household account)
    const isOwner = transaction.user_id === user.id;

    if (!isOwner) {
      const accountAccess = await getAccessibleAccount(
        supabase,
        user.id,
        transaction.account_id,
      );
      if (!accountAccess || transaction.is_private === true) {
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
        is_private: transaction.is_private,
        is_owner: isOwner,
        split_requested: transaction.split_requested,
        split_completed_at: transaction.split_completed_at,
        collaborator_id: transaction.collaborator_id,
        trip_id: transaction.trip_id ?? null,
      },
    });
  } catch {
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

    if (Object.prototype.hasOwnProperty.call(body, "split_requested")) {
      const parsed = splitUpdateSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      return await updateSplit(supabase, user.id, id, parsed.data);
    }

    // Extract updateable fields
    const {
      date,
      amount,
      description,
      category_id,
      subcategory_id,
      account_id,
      trip_id,
    } = body;

    // Build update object with only provided fields
    const updateData: TransactionUpdateData = {};
    if (date !== undefined) updateData.date = date;
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (subcategory_id !== undefined)
      updateData.subcategory_id = subcategory_id;
    if (account_id !== undefined) updateData.account_id = account_id;
    // Trip tag: null/"" untags; anything else must name a trip this user can
    // see (own, or the partner's household-scope trip).
    if (trip_id !== undefined) {
      if (trip_id === null || trip_id === "") {
        updateData.trip_id = null;
      } else {
        if (!(await canAccessTrip(supabase, user.id, trip_id))) {
          return NextResponse.json({ error: "Invalid trip_id" }, { status: 400 });
        }
        updateData.trip_id = String(trip_id);
      }
    }

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
  } catch {
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

    // Use admin client to bypass RLS for cascading soft-delete to child transactions
    const adminClient = supabaseAdmin();

    // Soft-delete child transactions (debt returns linked via parent_transaction_id)
    // so they vanish from the user's view alongside the parent. They will be
    // restored together when the parent is restored from the Recycle Bin.
    const nowIso = new Date().toISOString();
    await adminClient
      .from("transactions")
      .update({ deleted_at: nowIso })
      .eq("parent_transaction_id", id)
      .is("deleted_at", null);

    // Soft-delete the transaction itself.
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: nowIso })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
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
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
