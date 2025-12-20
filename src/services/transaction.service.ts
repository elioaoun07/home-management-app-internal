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
}

export interface UpdateTransactionDTO {
  id: string;
  date?: string;
  amount?: number;
  description?: string;
  category_id?: string | null;
  subcategory_id?: string | null;
}

export interface TransactionService {
  getTransactions(userId: string, filters?: TransactionFilters): Promise<any[]>;
  createTransaction(userId: string, data: CreateTransactionDTO): Promise<any>;
  updateTransaction(userId: string, data: UpdateTransactionDTO): Promise<any>;
}

export class SupabaseTransactionService implements TransactionService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Deducts an amount from the account balance (for expense transactions)
   */
  private async deductFromAccountBalance(
    accountId: string,
    amount: number
  ): Promise<void> {
    try {
      const { data: currentBalance, error: fetchError } = await this.supabase
        .from("account_balances")
        .select("balance")
        .eq("account_id", accountId)
        .single();

      if (fetchError) {
        console.error("Error fetching account balance:", fetchError);
        return;
      }

      if (currentBalance) {
        const newBalance = Number(currentBalance.balance) - amount;
        const { error: updateError } = await this.supabase
          .from("account_balances")
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountId);

        if (updateError) {
          console.error("Error updating account balance:", updateError);
        }
      }
    } catch (e) {
      console.error("Failed to deduct from account balance:", e);
    }
  }

  /**
   * Updates the updated_at timestamp on account_balances when a confirmed transaction
   * affects the balance. Draft transactions should NOT trigger this update.
   */
  private async touchAccountBalanceUpdatedAt(accountId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("account_balances")
        .update({ updated_at: new Date().toISOString() })
        .eq("account_id", accountId);

      if (error) {
        console.error("Error updating account_balances.updated_at:", error);
        // Non-critical error - don't throw, just log
      }
    } catch (e) {
      console.error("Failed to touch account balance updated_at:", e);
    }
  }

  async getTransactions(userId: string, filters: TransactionFilters = {}) {
    const { start, end, limit = 200 } = filters;

    // Determine if user has a household link to include partner transactions
    const { data: link } = await this.supabase
      .from("household_links")
      .select(
        "owner_user_id, owner_email, partner_user_id, partner_email, active"
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
        split_requested, collaborator_id, collaborator_amount, collaborator_description, split_completed_at,
        category:user_categories!transactions_category_fk(name, color),
        subcategory:user_categories!transactions_subcategory_fk(name, color)`
      )
      .order("inserted_at", { ascending: false })
      .limit(limit);

    // Apply date filters if provided
    if (start) query = query.gte("date", start);
    if (end) query = query.lte("date", end);

    // Filter by user + partner if household linked
    // Also include transactions where user is the collaborator (for split bills)
    if (partnerId) {
      query = query.or(
        `user_id.in.(${userId},${partnerId}),collaborator_id.eq.${userId}`
      );
    } else {
      query = query.or(`user_id.eq.${userId},collaborator_id.eq.${userId}`);
    }

    const { data: rawRows, error } = (await query) as any;

    if (error) {
      console.error("Failed to fetch transactions:", error);
      throw new Error("Failed to fetch transactions");
    }

    // Fetch account names for all account IDs (including partner's accounts)
    const accountIds = [
      ...new Set((rawRows || []).map((r: any) => r.account_id).filter(Boolean)),
    ];
    let accountNamesMap: Record<string, string> = {};

    if (accountIds.length > 0) {
      // Fetch accounts for current user
      const { data: myAccounts } = await this.supabase
        .from("accounts")
        .select("id, name")
        .in("id", accountIds);

      if (myAccounts) {
        myAccounts.forEach((acc: any) => {
          accountNamesMap[acc.id] = acc.name;
        });
      }

      // If household linked, fetch partner's account names
      if (partnerId) {
        const { data: partnerAccounts } = await this.supabase
          .from("accounts")
          .select("id, name")
          .eq("user_id", partnerId)
          .in("id", accountIds);

        if (partnerAccounts) {
          partnerAccounts.forEach((acc: any) => {
            accountNamesMap[acc.id] = acc.name;
          });
        }
      }
    }

    // Fetch category names for partner's categories
    const categoryIds = [
      ...new Set(
        (rawRows || []).map((r: any) => r.category_id).filter(Boolean)
      ),
    ];
    const subcategoryIds = [
      ...new Set(
        (rawRows || []).map((r: any) => r.subcategory_id).filter(Boolean)
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

    // Filter out private transactions from partner's view
    const filteredRows = (rawRows || []).filter((r: any) => {
      // If it's the user's own transaction, show it (even if private)
      if (r.user_id === userId) return true;
      // If it's partner's transaction and it's private, hide it
      if (r.is_private === true) return false;
      return true;
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
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
      } else {
        partnerName = "Partner";
      }
    }

    return (filteredRows || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      category:
        categoryNamesMap[r.category_id]?.name || r.category?.name || null,
      subcategory:
        categoryNamesMap[r.subcategory_id]?.name || r.subcategory?.name || null,
      amount: r.amount,
      description: r.description,
      account_id: r.account_id,
      category_id: r.category_id,
      subcategory_id: r.subcategory_id,
      inserted_at: r.inserted_at,
      user_id: r.user_id,
      user_name: r.user_id === userId ? meName : partnerName || "Partner",
      account_name: accountNamesMap[r.account_id] || "Unknown",
      category_color:
        categoryNamesMap[r.category_id]?.color ||
        r.category?.color ||
        "#38bdf8",
      subcategory_color:
        categoryNamesMap[r.subcategory_id]?.color ||
        r.subcategory?.color ||
        "#38bdf8",
      is_private: r.is_private || false,
      is_owner: r.user_id === userId,
      // Track if the current user is the collaborator on this split transaction (must be boolean!)
      is_collaborator: !!(r.collaborator_id === userId && r.split_completed_at),
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
      collaborator_description: r.collaborator_description || null,
      split_completed_at: r.split_completed_at || null,
      // Calculate total amount for completed splits
      total_amount:
        r.split_requested && r.split_completed_at && r.collaborator_amount
          ? r.amount + r.collaborator_amount
          : r.amount,
    }));
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
    } = data;

    // Validate required fields
    if (!account_id || !category_id || !amount) {
      throw new Error("account_id, category_id, and amount are required");
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
      .eq("user_id", userId)
      .single();

    if (categoryError) {
      console.error("Error fetching category:", categoryError);
      throw new Error("Invalid category_id");
    }

    // Get subcategory name if provided (validation)
    if (subcategory_id) {
      const { error: subcategoryError } = await this.supabase
        .from("user_categories")
        .select("name")
        .eq("id", subcategory_id)
        .eq("user_id", userId)
        .single();

      if (subcategoryError) {
        console.error("Error fetching subcategory:", subcategoryError);
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
    };

    const { data: created, error } = await this.supabase
      .from("transactions")
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      throw new Error("Failed to create transaction");
    }

    // If split requested, create a notification for the collaborator
    if (split_requested && collaboratorId) {
      // Get category name for notification
      const { data: categoryData } = await this.supabase
        .from("user_categories")
        .select("name")
        .eq("id", category_id)
        .single();

      await this.supabase.from("notifications").insert({
        user_id: collaboratorId,
        title: "Split Bill Request",
        message: `You've been asked to add your portion to a $${amount} ${categoryData?.name || "expense"}`,
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
        },
        transaction_id: created.id,
      });
    }

    // Deduct the transaction amount from the account balance
    // Note: Transactions created via this service are always confirmed (not drafts)
    await this.deductFromAccountBalance(account_id, amount);

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
      const { data: accountData } = await this.supabase
        .from("accounts")
        .select("name")
        .eq("id", account_id)
        .single();
      if (accountData) {
        accountName = accountData.name;
      }
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
    const { id, date, amount, description, category_id, subcategory_id } = data;

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
      console.error("Error updating transaction:", error);
      throw new Error("Failed to update transaction");
    }

    // Update account_balances.updated_at if this is a confirmed transaction
    // and we updated fields that affect the balance (amount or date)
    if (
      updated &&
      !updated.is_draft &&
      (updateFields.amount !== undefined || updateFields.date !== undefined)
    ) {
      await this.touchAccountBalanceUpdatedAt(updated.account_id);
    }

    return updated;
  }
}
