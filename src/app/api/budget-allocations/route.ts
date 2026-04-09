import { supabaseServer } from "@/lib/supabase/server";
import type {
  BudgetCategoryView,
  BudgetSubcategoryView,
  BudgetSummary,
  IncomeAccountBalance,
} from "@/types/budgetAllocation";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const emptySummary: BudgetSummary = {
  total_budget: 0,
  total_spent: 0,
  total_remaining: 0,
  user_budget: 0,
  user_spent: 0,
  partner_budget: 0,
  partner_spent: 0,
  shared_budget: 0,
  income_balance: 0,
  user_income_balance: 0,
  partner_income_balance: 0,
  income_accounts: [],
  unallocated: 0,
  wallet_balance: 0,
  user_wallet_balance: 0,
  partner_wallet_balance: 0,
  categories: [],
};

/**
 * GET /api/budget-allocations
 * Returns budget allocations with merged categories across expense accounts,
 * income balances, and spending data.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // YYYY-MM format
    const accountId = searchParams.get("accountId");

    // Get household link to check for partner
    const { data: householdLink } = await supabase
      .from("household_links")
      .select("*")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .single();

    const partnerId = householdLink
      ? householdLink.owner_user_id === user.id
        ? householdLink.partner_user_id
        : householdLink.owner_user_id
      : null;

    const userIds = partnerId ? [user.id, partnerId] : [user.id];

    // Fetch ALL accounts for users
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, type, user_id")
      .in("user_id", userIds);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        summary: emptySummary,
        hasPartner: !!partnerId,
        accounts: [],
      });
    }

    const expenseAccounts = accounts.filter((a) => a.type === "expense");
    const incomeAccounts = accounts.filter((a) => a.type === "income");
    const expenseAccountIds = accountId
      ? [accountId]
      : expenseAccounts.map((a) => a.id);
    const allAccountIds = accounts.map((a) => a.id);

    // --- Fetch income balances ---
    const incomeAccountBalances: IncomeAccountBalance[] = [];
    if (incomeAccounts.length > 0) {
      const { data: balances } = await supabase
        .from("account_balances")
        .select("account_id, user_id, balance")
        .in(
          "account_id",
          incomeAccounts.map((a) => a.id),
        );

      for (const acc of incomeAccounts) {
        const bal = (balances || []).find((b) => b.account_id === acc.id);
        incomeAccountBalances.push({
          account_id: acc.id,
          account_name: acc.name,
          user_id: acc.user_id,
          balance: Number(bal?.balance ?? 0),
        });
      }
    }

    const userIncomeBalance = incomeAccountBalances
      .filter((b) => b.user_id === user.id)
      .reduce((s, b) => s + b.balance, 0);
    const partnerIncomeBalance = incomeAccountBalances
      .filter((b) => b.user_id === partnerId)
      .reduce((s, b) => s + b.balance, 0);
    const totalIncomeBalance = userIncomeBalance + partnerIncomeBalance;

    // --- Fetch wallet (expense account named "Wallet") balances ---
    const walletAccounts = expenseAccounts.filter((a) =>
      a.name.toLowerCase().includes("wallet"),
    );
    let userWalletBalance = 0;
    let partnerWalletBalance = 0;
    if (walletAccounts.length > 0) {
      const { data: walletBals } = await supabase
        .from("account_balances")
        .select("account_id, user_id, balance")
        .in(
          "account_id",
          walletAccounts.map((a) => a.id),
        );
      for (const wa of walletAccounts) {
        const bal = (walletBals || []).find((b) => b.account_id === wa.id);
        const amount = Number(bal?.balance ?? 0);
        if (wa.user_id === user.id) userWalletBalance += amount;
        else if (wa.user_id === partnerId) partnerWalletBalance += amount;
      }
    }
    const totalWalletBalance = userWalletBalance + partnerWalletBalance;

    // --- Fetch budget allocations ---
    let allocations: any[] = [];
    try {
      let query = supabase
        .from("budget_allocations")
        .select(
          `
          *,
          category:user_categories!budget_allocations_category_id_fkey(
            id, name, color, parent_id
          ),
          subcategory:user_categories!budget_allocations_subcategory_id_fkey(
            id, name
          ),
          account:accounts!budget_allocations_account_id_fkey(
            id, name
          )
        `,
        )
        .eq("user_id", user.id);

      if (month) {
        query = query.or(`budget_month.eq.${month},budget_month.is.null`);
      }

      if (accountId) {
        query = query.eq("account_id", accountId);
      }

      const { data, error } = await query;
      if (!error) allocations = data || [];
    } catch {
      // Table doesn't exist yet
    }

    // --- Fetch ALL categories for expense accounts ---
    let categoriesQuery = supabase
      .from("user_categories")
      .select("id, name, color, parent_id, account_id, position")
      .in("user_id", userIds)
      .eq("visible", true)
      .order("position", { ascending: true });

    if (accountId) {
      categoriesQuery = categoriesQuery.eq("account_id", accountId);
    } else {
      categoriesQuery = categoriesQuery.in("account_id", expenseAccountIds);
    }

    const { data: allCategories } = await categoriesQuery;

    const rootCategories = (allCategories || []).filter((c) => !c.parent_id);
    const subcategories = (allCategories || []).filter((c) => c.parent_id);

    // --- Fetch transactions for spending ---
    const startDate = month
      ? `${month}-01`
      : new Date().toISOString().slice(0, 8) + "01";
    const endDate = month
      ? new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0)
          .toISOString()
          .slice(0, 10)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
          .toISOString()
          .slice(0, 10);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, category_id, subcategory_id, user_id, account_id")
      .in("account_id", expenseAccountIds)
      .gte("date", startDate)
      .lte("date", endDate);

    // Build spending map by category/subcategory name (for merging)
    const spendingByName: Record<string, { user: number; partner: number }> =
      {};
    const spendingById: Record<string, { user: number; partner: number }> = {};

    // Map category IDs to names for merging
    const catIdToName: Record<string, string> = {};
    for (const c of allCategories || []) {
      catIdToName[c.id] = c.name;
    }

    (transactions || []).forEach((tx) => {
      const catId = tx.subcategory_id || tx.category_id;
      if (!catId) return;

      // Track by ID
      if (!spendingById[catId]) spendingById[catId] = { user: 0, partner: 0 };
      if (tx.user_id === user.id) spendingById[catId].user += tx.amount;
      else if (tx.user_id === partnerId)
        spendingById[catId].partner += tx.amount;

      // Track by name (for merged view)
      const name = catIdToName[catId];
      if (name) {
        if (!spendingByName[name])
          spendingByName[name] = { user: 0, partner: 0 };
        if (tx.user_id === user.id) spendingByName[name].user += tx.amount;
        else if (tx.user_id === partnerId)
          spendingByName[name].partner += tx.amount;
      }
    });

    // --- Merge categories by name across accounts ---
    const mergedMap = new Map<
      string,
      {
        name: string;
        color: string;
        ids: string[];
        accountIds: string[];
        subcategoryMap: Map<
          string,
          { name: string; ids: string[]; parentIds: string[] }
        >;
      }
    >();

    for (const cat of rootCategories) {
      const existing = mergedMap.get(cat.name);
      if (existing) {
        existing.ids.push(cat.id);
        if (!existing.accountIds.includes(cat.account_id))
          existing.accountIds.push(cat.account_id);
      } else {
        mergedMap.set(cat.name, {
          name: cat.name,
          color: cat.color || "#38bdf8",
          ids: [cat.id],
          accountIds: [cat.account_id],
          subcategoryMap: new Map(),
        });
      }
    }

    // Merge subcategories by name under their parent
    for (const sub of subcategories) {
      const parentName = catIdToName[sub.parent_id!];
      if (!parentName) continue;
      const parent = mergedMap.get(parentName);
      if (!parent) continue;

      const existingSub = parent.subcategoryMap.get(sub.name);
      if (existingSub) {
        existingSub.ids.push(sub.id);
        existingSub.parentIds.push(sub.parent_id!);
      } else {
        parent.subcategoryMap.set(sub.name, {
          name: sub.name,
          ids: [sub.id],
          parentIds: [sub.parent_id!],
        });
      }
    }

    // Build merged category views
    const categoryViews: BudgetCategoryView[] = [];

    for (const [catName, merged] of mergedMap) {
      // Aggregate allocations for all merged IDs
      const catAllocations = allocations.filter(
        (a) => merged.ids.includes(a.category_id) && !a.subcategory_id,
      );

      let userBudget = 0,
        partnerBudget = 0,
        sharedBudget = 0;
      catAllocations.forEach((a) => {
        if (a.assigned_to === "user") userBudget += a.monthly_budget;
        else if (a.assigned_to === "partner") partnerBudget += a.monthly_budget;
        else sharedBudget += a.monthly_budget;
      });

      // Aggregate spending across merged IDs
      const catSpending = merged.ids.reduce(
        (acc, id) => {
          const s = spendingById[id] || { user: 0, partner: 0 };
          acc.user += s.user;
          acc.partner += s.partner;
          return acc;
        },
        { user: 0, partner: 0 },
      );

      // Build subcategory views
      const subcategoryViews: BudgetSubcategoryView[] = [];
      let totalSubSpentUser = 0;
      let totalSubSpentPartner = 0;

      for (const [subName, mergedSub] of merged.subcategoryMap) {
        const subAllocations = allocations.filter((a) =>
          mergedSub.ids.includes(a.subcategory_id),
        );

        let subUserBudget = 0,
          subPartnerBudget = 0,
          subSharedBudget = 0;
        subAllocations.forEach((a) => {
          if (a.assigned_to === "user") subUserBudget += a.monthly_budget;
          else if (a.assigned_to === "partner")
            subPartnerBudget += a.monthly_budget;
          else subSharedBudget += a.monthly_budget;
        });

        const subSpending = mergedSub.ids.reduce(
          (acc, id) => {
            const s = spendingById[id] || { user: 0, partner: 0 };
            acc.user += s.user;
            acc.partner += s.partner;
            return acc;
          },
          { user: 0, partner: 0 },
        );

        totalSubSpentUser += subSpending.user;
        totalSubSpentPartner += subSpending.partner;

        subcategoryViews.push({
          subcategory_id: mergedSub.ids[0],
          subcategory_name: subName,
          subcategory_icon: null,
          total_budget: subUserBudget + subPartnerBudget + subSharedBudget,
          user_budget: subUserBudget,
          partner_budget: subPartnerBudget,
          shared_budget: subSharedBudget,
          total_spent: subSpending.user + subSpending.partner,
          user_spent: subSpending.user,
          partner_spent: subSpending.partner,
          percentage: 0, // Client computes this
          allocations: subAllocations.map((a) => ({
            ...a,
            category_name: catName,
            category_icon: null,
            category_color: merged.color,
            subcategory_name: subName,
            subcategory_icon: null,
            account_name: a.account?.name,
          })),
          merged_subcategory_ids:
            mergedSub.ids.length > 1 ? mergedSub.ids : undefined,
        });
      }

      const totalUserSpent = catSpending.user + totalSubSpentUser;
      const totalPartnerSpent = catSpending.partner + totalSubSpentPartner;

      // Use first account as primary reference
      const primaryAccountId = merged.accountIds[0];
      const primaryAccount = accounts.find((a) => a.id === primaryAccountId);

      categoryViews.push({
        category_id: merged.ids[0],
        category_name: catName,
        category_icon: null,
        category_color: merged.color,
        account_id: primaryAccountId,
        account_name: primaryAccount?.name || "",
        total_budget: userBudget + partnerBudget + sharedBudget,
        user_budget: userBudget,
        partner_budget: partnerBudget,
        shared_budget: sharedBudget,
        total_spent: totalUserSpent + totalPartnerSpent,
        user_spent: totalUserSpent,
        partner_spent: totalPartnerSpent,
        subcategories:
          subcategoryViews.length > 0 ? subcategoryViews : undefined,
        allocations: catAllocations.map((a) => ({
          ...a,
          category_name: catName,
          category_icon: null,
          category_color: merged.color,
          account_name: a.account?.name,
        })),
        merged_category_ids: merged.ids.length > 1 ? merged.ids : undefined,
        merged_account_ids:
          merged.accountIds.length > 1 ? merged.accountIds : undefined,
      });
    }

    // Calculate summary
    const totalBudget = categoryViews.reduce(
      (sum, c) => sum + c.total_budget,
      0,
    );
    const totalSpent = categoryViews.reduce((sum, c) => sum + c.total_spent, 0);

    const summary: BudgetSummary = {
      total_budget: totalBudget,
      total_spent: totalSpent,
      total_remaining: totalBudget - totalSpent,
      user_budget: categoryViews.reduce((sum, c) => sum + c.user_budget, 0),
      user_spent: categoryViews.reduce((sum, c) => sum + c.user_spent, 0),
      partner_budget: categoryViews.reduce(
        (sum, c) => sum + c.partner_budget,
        0,
      ),
      partner_spent: categoryViews.reduce((sum, c) => sum + c.partner_spent, 0),
      shared_budget: categoryViews.reduce((sum, c) => sum + c.shared_budget, 0),
      income_balance: totalIncomeBalance,
      user_income_balance: userIncomeBalance,
      partner_income_balance: partnerIncomeBalance,
      income_accounts: incomeAccountBalances,
      unallocated: totalIncomeBalance - totalBudget,
      wallet_balance: totalWalletBalance,
      user_wallet_balance: userWalletBalance,
      partner_wallet_balance: partnerWalletBalance,
      categories: categoryViews,
    };

    return NextResponse.json({
      summary,
      hasPartner: !!partnerId,
      accounts: accounts || [],
    });
  } catch (error) {
    console.error("Budget allocations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget data" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/budget-allocations
 * Create or update a budget allocation
 */
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    category_id,
    subcategory_id = null,
    account_id,
    assigned_to = "both",
    monthly_budget,
    budget_month = null,
  } = body;

  if (!category_id || !account_id || monthly_budget === undefined) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: category_id, account_id, monthly_budget",
      },
      { status: 400 },
    );
  }

  // Find existing allocation matching the logical key
  // (can't use upsert because subcategory_id/budget_month can be NULL,
  //  and Postgres treats NULL ≠ NULL for ON CONFLICT)
  let existingQuery = supabase
    .from("budget_allocations")
    .select("id")
    .eq("user_id", user.id)
    .eq("category_id", category_id)
    .eq("assigned_to", assigned_to);

  if (subcategory_id) {
    existingQuery = existingQuery.eq("subcategory_id", subcategory_id);
  } else {
    existingQuery = existingQuery.is("subcategory_id", null);
  }

  if (budget_month) {
    existingQuery = existingQuery.eq("budget_month", budget_month);
  } else {
    existingQuery = existingQuery.is("budget_month", null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  let data, error;
  if (existing) {
    // Update existing allocation
    ({ data, error } = await supabase
      .from("budget_allocations")
      .update({
        monthly_budget,
        account_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    // Insert new allocation
    ({ data, error } = await supabase
      .from("budget_allocations")
      .insert({
        user_id: user.id,
        category_id,
        subcategory_id,
        account_id,
        assigned_to,
        monthly_budget,
        budget_month,
      })
      .select()
      .single());
  }

  if (error) {
    if ((error as any).code === "23505") {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/budget-allocations
 * Delete a budget allocation by ID
 */
export async function DELETE(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing allocation ID" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("budget_allocations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
