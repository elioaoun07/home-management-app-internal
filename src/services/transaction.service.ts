import { getAccessibleAccount } from "@/lib/accountAccess";
import { adjustAccountBalance } from "@/lib/balance";
import type { AccountType } from "@/lib/balance-utils";
import { getBalanceDelta } from "@/lib/balance-utils";
import { SupabaseClient } from "@supabase/supabase-js";

export interface TransactionFilters {
  start?: string;
  end?: string;
  limit?: number;
}

export interface CreateTransactionDTO {
  account_id: string;
  category_id: string;
  subcategory_id?: string;
  amount: number;
  description?: string;
  date?: string;
  is_private?: boolean;
  split_requested?: boolean;
  /** Total bill amount for split bills — partner's suggested share = total - amount */
  total_bill_amount?: number;
  /** LBP change received (in thousands, e.g., 600 = 600,000 LBP). For Lebanon dual-currency. */
  lbp_change_received?: number | null;
}

export interface UpdateTransactionDTO {
  id: string;
  date?: string;
  amount?: number;
  description?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  /** LBP change received (in thousands, e.g., 600 = 600,000 LBP). For Lebanon dual-currency. */
  lbp_change_received?: number | null;
}

export interface TransactionService {
  getTransactions(userId: string, filters?: TransactionFilters): Promise<any[]>;
  createTransaction(userId: string, data: CreateTransactionDTO): Promise<any>;
  updateTransaction(userId: string, data: UpdateTransactionDTO): Promise<any>;
}

export class SupabaseTransactionService implements TransactionService {
  constructor(private supabase: SupabaseClient) {}

  // Balance is now formula-based (computed in GET /api/accounts/[id]/balance).
  // No imperative balance updates needed on transaction create/edit/delete.

  async getTransactions(userId: string, filters: TransactionFilters = {}) {
    const { start, end, limit = 10000 } = filters;

    // Determine if user has a household link to include partner transactions
    const { data: link } = await this.supabase
      .from("household_links")
      .select(
        "owner_user_id, owner_email, partner_user_id, partner_email, active",
      )
      .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const partnerId = link
      ? link.owner_user_id === userId
        ? link.partner_user_id
        : link.owner_user_id
      : null;

    // Build query with proper joins
    let query = this.supabase
      .from("transactions")
      .select(
        `id, date, category_id, subcategory_id, amount, description, account_id, inserted_at, user_id, is_private,
        split_requested, collaborator_id, collaborator_amount, collaborator_description, split_completed_at, lbp_change_received,
        scheduled_date, is_debt_return, parent_transaction_id, receipt_url,
        category:user_categories!transactions_category_fk(name, color),
        subcategory:user_categories!transactions_subcategory_fk(name, color)`,
      )
      .is("parent_transaction_id", null)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("inserted_at", { ascending: false })
      .limit(limit);

    // Apply date filters if provided
    if (start) query = query.gte("date", start);
    if (end) query = query.lte("date", end);

    // Filter by user + partner if household linked
    // Also include transactions where user is the collaborator (for split bills)
    if (partnerId) {
      query = query.or(
        `user_id.in.(${userId},${partnerId}),collaborator_id.eq.${userId}`,
      );
    } else {
      query = query.or(`user_id.eq.${userId},collaborator_id.eq.${userId}`);
    }

    const { data: rawRows, error } = (await query) as any;

    if (error) {
      throw new Error("Failed to fetch transactions");
    }

    // Fetch account names for all account IDs (including partner's accounts)
    const accountIds = [
      ...new Set((rawRows || []).map((r: any) => r.account_id).filter(Boolean)),
    ];
    let accountMap: Record<
      string,
      { name: string; user_id: string; is_public?: boolean | null }
    > = {};

    if (accountIds.length > 0) {
      const { data: accounts } = await this.supabase
        .from("accounts")
        .select("id, name, user_id, is_public")
        .in("id", accountIds);

      if (accounts) {
        accounts.forEach((acc: any) => {
          accountMap[acc.id] = {
            name: acc.name,
            user_id: acc.user_id,
            is_public: acc.is_public,
          };
        });
      }
    }

    // Fetch category names for partner's categories
    const categoryIds = [
      ...new Set(
        (rawRows || []).map((r: any) => r.category_id).filter(Boolean),
      ),
    ];
    const subcategoryIds = [
      ...new Set(
        (rawRows || []).map((r: any) => r.subcategory_id).filter(Boolean),
      ),
    ];
    let categoryNamesMap: Record<string, { name: string; color?: string }> = {};

    if (categoryIds.length > 0 || subcategoryIds.length > 0) {
      const allCatIds = [...categoryIds, ...subcategoryIds];

      // Fetch categories for current user
      const { data: myCategories } = await this.supabase
        .from("user_categories")
        .select("id, name, color")
        .in("id", allCatIds);

      if (myCategories) {
        myCategories.forEach((cat: any) => {
          categoryNamesMap[cat.id] = {
            name: cat.name,
            color: cat.color,
          };
        });
      }

      // If household linked, fetch partner's category names
      if (partnerId) {
        const { data: partnerCategories } = await this.supabase
          .from("user_categories")
          .select("id, name, color")
          .eq("user_id", partnerId)
          .in("id", allCatIds);

        if (partnerCategories) {
          partnerCategories.forEach((cat: any) => {
            categoryNamesMap[cat.id] = {
              name: cat.name,
              color: cat.color,
            };
          });
        }
      }
    }

    // Include all household transactions (own + partner). The partner's PRIVATE
    // transactions are kept too, but their content is masked in the mapping
    // below (description/category withheld) — the amount is preserved so it
    // still counts toward shared totals and every spending figure stays
    // consistent across the app. account.is_public controls the expense-form
    // account picker only — it does NOT restrict dashboard visibility.
    const filteredRows = (rawRows || []).filter((r: any) => {
      if (r.user_id === userId) return true;
      if (r.collaborator_id === userId && r.split_completed_at) return true;
      const account = accountMap[r.account_id];
      if (!account) return false;
      if (account.user_id === userId) return true;
      if (partnerId && account.user_id === partnerId) return true;
      return false;
    });

    // Fetch user theme preferences for color coding
    const { data: myPrefs } = await this.supabase
      .from("user_preferences")
      .select("theme")
      .eq("user_id", userId)
      .maybeSingle();

    let partnerTheme: string | null = null;
    if (partnerId) {
      const { data: partnerPrefs } = await this.supabase
        .from("user_preferences")
        .select("theme")
        .eq("user_id", partnerId)
        .maybeSingle();
      partnerTheme = partnerPrefs?.theme || null;
    }

    // Compute display names for household
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    const meMeta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const meName =
      (meMeta.full_name as string | undefined) ||
      (meMeta.name as string | undefined) ||
      "Me";

    let partnerName: string | undefined = undefined;
    if (partnerId && link) {
      const partnerEmail =
        link.owner_user_id === partnerId
          ? (link.owner_email as string | undefined)
          : (link.partner_email as string | undefined);
      if (partnerEmail) {
        const emailName = partnerEmail.split("@")[0].replace(/[._-]/g, " ");
        partnerName = emailName
          .split(" ")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" ");
      } else {
        partnerName = "Partner";
      }
    }

    const result = (filteredRows || []).map((r: any) => {
      const isOwner = r.user_id === userId;
      const isCollaborator = !!(
        r.collaborator_id === userId && r.split_completed_at
      );
      // A partner's private transaction is masked. By product decision the
      // top-level CATEGORY is kept (so the row still buckets under e.g. "Gift"
      // on the dashboards and counts in that category's total), but the finer
      // detail — subcategory, description, receipt, debt — is redacted so the
      // viewer can't see exactly WHAT it was. The amount is preserved and the
      // `is_masked` flag tells the UI to permanently blur that one amount
      // (independent of the global privacy toggle) so it's never flashed.
      const isMasked = r.is_private === true && !isOwner && !isCollaborator;

      return {
        id: r.id,
        date: r.date,
        // Real category kept even when masked → buckets under its true category.
        category:
          categoryNamesMap[r.category_id]?.name || r.category?.name || null,
        subcategory: isMasked
          ? null
          : categoryNamesMap[r.subcategory_id]?.name ||
            r.subcategory?.name ||
            null,
        amount: r.amount,
        description: isMasked ? null : r.description,
        account_id: r.account_id,
        category_id: r.category_id,
        subcategory_id: isMasked ? null : r.subcategory_id,
        inserted_at: r.inserted_at,
        user_id: r.user_id,
        user_name: r.user_id === userId ? meName : partnerName || "Partner",
        account_name: accountMap[r.account_id]?.name || "Unknown",
        // Real category color kept so the masked row carries its category's hue.
        category_color:
          categoryNamesMap[r.category_id]?.color ||
          r.category?.color ||
          "#38bdf8",
        subcategory_color: isMasked
          ? "#64748b"
          : categoryNamesMap[r.subcategory_id]?.color ||
            r.subcategory?.color ||
            "#38bdf8",
        is_private: r.is_private || false,
        is_owner: isOwner,
        // Partner's private row — UI blurs the amount and hides the content.
        is_masked: isMasked,
        // Track if the current user is the collaborator on this split transaction (must be boolean!)
        is_collaborator: isCollaborator,
        user_theme:
          r.user_id === userId
            ? myPrefs?.theme || "blue"
            : // Reverse theme for partner: if I'm blue, partner is pink; if I'm pink, partner is blue
              myPrefs?.theme === "pink"
              ? "blue"
              : "pink",
        // Split bill fields
        split_requested: r.split_requested || false,
        collaborator_id: r.collaborator_id || null,
        collaborator_amount: r.collaborator_amount || null,
        collaborator_description: isMasked
          ? null
          : r.collaborator_description || null,
        split_completed_at: r.split_completed_at || null,
        // Calculate total amount for completed splits
        total_amount:
          r.split_requested && r.split_completed_at && r.collaborator_amount
            ? r.amount + r.collaborator_amount
            : r.amount,
        // LBP change tracking for Lebanon dual-currency
        lbp_change_received: r.lbp_change_received ?? null,
        // Future payment / debt return fields
        scheduled_date: r.scheduled_date ?? null,
        is_debt_return: r.is_debt_return || false,
        // Receipt
        receipt_url: isMasked ? null : (r.receipt_url ?? null),
      };
    });

    // Batch-fetch debt data for all transaction IDs
    const txIds = result.map((r: any) => r.id);
    if (txIds.length > 0) {
      const { data: debts } = await this.supabase
        .from("debts")
        .select(
          "id, transaction_id, debtor_name, original_amount, returned_amount, status",
        )
        .in("transaction_id", txIds);

      if (debts && debts.length > 0) {
        const debtByTxId = new Map(
          debts.map((d: any) => [d.transaction_id, d]),
        );
        for (const tx of result) {
          if (tx.is_masked) continue; // never expose a partner's private debt
          const debt = debtByTxId.get(tx.id);
          if (debt) {
            tx.debt_id = debt.id;
            tx.debtor_name = debt.debtor_name;
            tx.debt_status = debt.status;
            tx.debt_original_amount = Number(debt.original_amount);
            tx.debt_returned_amount = Number(debt.returned_amount);
            // Net cost = full bill minus what the friend has paid back so far
            // e.g. bill $50, friend owes $25, returned $0  → net cost = $50 (still out full amount)
            //       bill $50, friend owes $25, returned $25 → net cost = $25 (your actual share)
            //       bill $10, friend owes $10, returned $10 → net cost = $0
            tx.debt_net_cost = Math.max(
              0,
              Number(tx.amount) - Number(debt.returned_amount),
            );
          }
        }
      }
    }

    return result;
  }

  async createTransaction(userId: string, data: CreateTransactionDTO) {
    const {
      account_id,
      category_id,
      subcategory_id,
      amount,
      description,
      date,
      is_private,
      split_requested,
      total_bill_amount,
      lbp_change_received,
    } = data;

    // Validate required fields
    if (!account_id || !category_id || !amount) {
      throw new Error("account_id, category_id, and amount are required");
    }

    const account = await getAccessibleAccount(
      this.supabase,
      userId,
      account_id,
    );
    if (!account?.canWrite) {
      throw new Error("Invalid account_id");
    }

    // If split requested, get the partner's user ID from household link
    let collaboratorId: string | null = null;
    if (split_requested) {
      const { data: link } = await this.supabase
        .from("household_links")
        .select("owner_user_id, partner_user_id")
        .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!link) {
        throw new Error("Split bill requires an active household link");
      }

      collaboratorId =
        link.owner_user_id === userId
          ? link.partner_user_id
          : link.owner_user_id;
    }

    // Get category name from category_id (validation)
    const { error: categoryError } = await this.supabase
      .from("user_categories")
      .select("name")
      .eq("id", category_id)
      .eq("user_id", account.user_id)
      .eq("account_id", account_id)
      .single();

    if (categoryError) {
      throw new Error("Invalid category_id");
    }

    // Get subcategory name if provided (validation)
    if (subcategory_id) {
      const { error: subcategoryError } = await this.supabase
        .from("user_categories")
        .select("name")
        .eq("id", subcategory_id)
        .eq("user_id", account.user_id)
        .eq("account_id", account_id)
        .single();

      if (subcategoryError) {
        throw new Error("Invalid subcategory_id");
      }
    }

    // Determine date: accept optional YYYY-MM-DD, default to today
    let txDate: string;
    if (typeof date === "string") {
      const valid =
        /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
      txDate = valid ? date : new Date().toISOString().split("T")[0];
    } else {
      txDate = new Date().toISOString().split("T")[0];
    }

    // Create transaction
    const transactionData: Record<string, unknown> = {
      user_id: userId,
      date: txDate, // YYYY-MM-DD
      category_id: category_id,
      subcategory_id: subcategory_id || null,
      amount: amount,
      description: description || "",
      account_id: account_id,
      is_private: is_private || false,
      split_requested: split_requested || false,
      collaborator_id: collaboratorId,
      lbp_change_received: lbp_change_received ?? null,
    };

    const { data: created, error } = await this.supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      throw new Error("Failed to create transaction");
    }

    // If split requested, create a notification for the collaborator
    // (Push notification is sent via API from the frontend after success)
    if (split_requested && collaboratorId) {
      // Get category name for notification
      const { data: categoryData } = await this.supabase
        .from("user_categories")
        .select("name")
        .eq("id", category_id)
        .single();

      // Compute partner's suggested amount from total bill if provided
      const suggestedAmount =
        total_bill_amount && total_bill_amount > amount
          ? total_bill_amount - amount
          : null;

      await this.supabase.from("notifications").insert({
        user_id: collaboratorId,
        title: "Split Bill Request",
        message: suggestedAmount
          ? `You've been asked to add your portion ($${suggestedAmount.toFixed(2)}) to a $${total_bill_amount!.toFixed(2)} ${categoryData?.name || "expense"}`
          : `You've been asked to add your portion to a $${amount} ${categoryData?.name || "expense"}`,
        icon: "split",
        notification_type: "transaction_pending",
        severity: "action",
        source: "transaction",
        priority: "high",
        action_type: "log_transaction",
        action_data: {
          transaction_id: created.id,
          owner_amount: amount,
          owner_description: description || "",
          category_name: categoryData?.name || "",
          ...(suggestedAmount != null && { suggested_amount: suggestedAmount }),
          ...(total_bill_amount && { total_bill_amount }),
        },
        transaction_id: created.id,
      });
    }

    // Adjust balance for the new transaction
    if (account_id && created) {
      const accountType = (account.type || "expense") as AccountType;
      const delta = getBalanceDelta(amount, accountType, false, "create");
      await adjustAccountBalance(account_id, delta, "transaction", {
        userId,
        transactionId: created.id,
        reason: description || undefined,
      });
    }

    // Fetch the category and subcategory names to return a complete transaction object
    // This is needed for optimistic UI to work correctly
    let categoryName: string | null = null;
    let categoryColor: string | null = null;
    let subcategoryName: string | null = null;
    let subcategoryColor: string | null = null;
    let accountName: string | null = null;

    // Fetch category details
    if (category_id) {
      const { data: categoryData } = await this.supabase
        .from("user_categories")
        .select("name, color")
        .eq("id", category_id)
        .single();
      if (categoryData) {
        categoryName = categoryData.name;
        categoryColor = categoryData.color;
      }
    }

    // Fetch subcategory details
    if (subcategory_id) {
      const { data: subcategoryData } = await this.supabase
        .from("user_categories")
        .select("name, color")
        .eq("id", subcategory_id)
        .single();
      if (subcategoryData) {
        subcategoryName = subcategoryData.name;
        subcategoryColor = subcategoryData.color;
      }
    }

    // Fetch account name
    if (account_id) {
      accountName = account.name;
    }

    // Return the complete transaction object with all display names
    return {
      ...created,
      category: categoryName,
      subcategory: subcategoryName,
      account_name: accountName,
      category_color: categoryColor || "#38bdf8",
      subcategory_color: subcategoryColor || "#38bdf8",
      is_owner: true,
      user_id: userId,
    };
  }

  async updateTransaction(userId: string, data: UpdateTransactionDTO) {
    const {
      id,
      date,
      amount,
      description,
      category_id,
      subcategory_id,
      lbp_change_received,
    } = data;

    if (!id) {
      throw new Error("id is required");
    }

    const updateFields: Record<string, any> = {};

    if (date !== undefined) {
      // Expect YYYY-MM-DD
      const d = typeof date === "string" ? date : String(date);
      // Quick validation: 10 chars and valid Date
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
      if (!valid) {
        throw new Error("Invalid date format (expected YYYY-MM-DD)");
      }
      updateFields.date = d;
    }

    if (amount !== undefined) {
      const num = typeof amount === "number" ? amount : Number(amount);
      if (!Number.isFinite(num)) {
        throw new Error("Invalid amount");
      }
      updateFields.amount = num;
    }

    if (description !== undefined) {
      updateFields.description = description ?? "";
    }

    if (category_id !== undefined) {
      if (category_id === null || category_id === "") {
        updateFields.category_id = null;
        // When clearing category, also clear subcategory if not explicitly set
        if (subcategory_id === undefined) updateFields.subcategory_id = null;
      } else {
        updateFields.category_id = String(category_id);
        // If category changes and subcategory not provided, clear subcategory as it may no longer be valid
        if (subcategory_id === undefined) updateFields.subcategory_id = null;
      }
    }

    if (subcategory_id !== undefined) {
      if (subcategory_id === null || subcategory_id === "") {
        updateFields.subcategory_id = null;
      } else {
        updateFields.subcategory_id = String(subcategory_id);
      }
    }

    // Handle LBP change (Lebanon dual-currency tracking)
    if (lbp_change_received !== undefined) {
      updateFields.lbp_change_received = lbp_change_received ?? null;
    }

    if (Object.keys(updateFields).length === 0) {
      throw new Error("No valid fields to update");
    }

    const { data: updated, error } = await this.supabase
      .from("transactions")
      .update(updateFields)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, account_id, is_draft")
      .single();

    if (error) {
      throw new Error("Failed to update transaction");
    }

    // Balance adjustment for updates is handled by the PATCH route handler
    // (it has access to the old transaction data needed to compute the delta)

    return updated;
  }
}
