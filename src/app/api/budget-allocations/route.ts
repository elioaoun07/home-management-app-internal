import { supabaseServer } from "@/lib/supabase/server";
import type {
  BudgetCategoryView,
  BudgetSummary,
} from "@/types/budgetAllocation";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/budget-allocations
 * Get all budget allocations for current user, with optional month filter
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

    // Fetch ALL accounts for this user (not just expense type)
    // Budget can be set for any account's categories
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, type, user_id")
      .or(
        `user_id.eq.${user.id}${partnerId ? `,user_id.eq.${partnerId}` : ""}`
      );

    const allAccountIds = (accounts || []).map((a) => a.id);

    // If no accounts, return empty summary
    if (allAccountIds.length === 0) {
      return NextResponse.json({
        summary: {
          total_budget: 0,
          total_spent: 0,
          total_remaining: 0,
          user_budget: 0,
          user_spent: 0,
          partner_budget: 0,
          partner_spent: 0,
          shared_budget: 0,
          categories: [],
        },
        hasPartner: !!partnerId,
        accounts: [],
      });
    }

    // Try to fetch budget allocations - table may not exist yet
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
        `
        )
        .eq("user_id", user.id);

      if (month) {
        query = query.or(`budget_month.eq.${month},budget_month.is.null`);
      }

      if (accountId) {
        query = query.eq("account_id", accountId);
      }

      const { data, error } = await query;

      if (!error) {
        allocations = data || [];
      }
      // If error (table doesn't exist), continue with empty allocations
    } catch {
      // Table doesn't exist yet, continue with empty allocations
    }

    // Fetch ALL categories for user's accounts (including subcategories)
    // Filter by user_id is CRITICAL - categories are user-specific
    let categoriesQuery = supabase
      .from("user_categories")
      .select("id, name, color, parent_id, account_id, position")
      .eq("user_id", user.id)
      .eq("visible", true)
      .order("position", { ascending: true });

    // Filter by specific account if provided
    if (accountId) {
      categoriesQuery = categoriesQuery.eq("account_id", accountId);
    } else {
      categoriesQuery = categoriesQuery.in("account_id", allAccountIds);
    }

    const { data: allCategories, error: catError } = await categoriesQuery;

    if (catError) {
      console.error("Categories fetch error:", catError);
    }

    // Separate parent categories and subcategories
    const categories = (allCategories || []).filter((c) => !c.parent_id);
    const subcategories = (allCategories || []).filter((c) => c.parent_id);

    // Fetch transactions for spending calculation
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
      .select("amount, category_id, subcategory_id, user_id")
      .in("account_id", allAccountIds)
      .gte("date", startDate)
      .lte("date", endDate);

    // Calculate spending by category/subcategory and user
    const spendingMap: Record<string, { user: number; partner: number }> = {};

    (transactions || []).forEach((tx) => {
      const key = tx.subcategory_id || tx.category_id;
      if (!key) return;

      if (!spendingMap[key]) {
        spendingMap[key] = { user: 0, partner: 0 };
      }

      if (tx.user_id === user.id) {
        spendingMap[key].user += tx.amount;
      } else if (tx.user_id === partnerId) {
        spendingMap[key].partner += tx.amount;
      }
    });

    // Build category view with budgets and spending
    const categoryViews: BudgetCategoryView[] = (categories || []).map(
      (cat) => {
        const catAllocations = (allocations || []).filter(
          (a) => a.category_id === cat.id && !a.subcategory_id
        );

        const catSubcategories = (subcategories || []).filter(
          (s) => s.parent_id === cat.id
        );

        // Calculate category-level budgets
        let userBudget = 0,
          partnerBudget = 0,
          sharedBudget = 0;
        catAllocations.forEach((a) => {
          if (a.assigned_to === "user") userBudget += a.monthly_budget;
          else if (a.assigned_to === "partner")
            partnerBudget += a.monthly_budget;
          else sharedBudget += a.monthly_budget;
        });

        const catSpending = spendingMap[cat.id] || { user: 0, partner: 0 };

        // Build subcategory views
        const subcategoryViews = catSubcategories.map((sub) => {
          const subAllocations = (allocations || []).filter(
            (a) => a.subcategory_id === sub.id
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

          const subSpending = spendingMap[sub.id] || { user: 0, partner: 0 };

          return {
            subcategory_id: sub.id,
            subcategory_name: sub.name,
            subcategory_icon: null,
            total_budget: subUserBudget + subPartnerBudget + subSharedBudget,
            user_budget: subUserBudget,
            partner_budget: subPartnerBudget,
            shared_budget: subSharedBudget,
            total_spent: subSpending.user + subSpending.partner,
            user_spent: subSpending.user,
            partner_spent: subSpending.partner,
            allocations: subAllocations.map((a) => ({
              ...a,
              category_name: cat.name,
              category_icon: null,
              category_color: cat.color,
              subcategory_name: sub.name,
              subcategory_icon: null,
              account_name: a.account?.name,
            })),
          };
        });

        // Add subcategory spending to category if not budgeted at subcategory level
        let totalUserSpent = catSpending.user;
        let totalPartnerSpent = catSpending.partner;
        subcategoryViews.forEach((sub) => {
          totalUserSpent += sub.user_spent;
          totalPartnerSpent += sub.partner_spent;
        });

        const account = accounts?.find((a) => a.id === cat.account_id);

        return {
          category_id: cat.id,
          category_name: cat.name,
          category_icon: null,
          category_color: cat.color || "#38bdf8",
          account_id: cat.account_id,
          account_name: account?.name || "",
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
            category_name: cat.name,
            category_icon: null,
            category_color: cat.color,
            account_name: a.account?.name,
          })),
        };
      }
    );

    // Calculate summary
    const summary: BudgetSummary = {
      total_budget: categoryViews.reduce((sum, c) => sum + c.total_budget, 0),
      total_spent: categoryViews.reduce((sum, c) => sum + c.total_spent, 0),
      total_remaining: 0,
      user_budget: categoryViews.reduce((sum, c) => sum + c.user_budget, 0),
      user_spent: categoryViews.reduce((sum, c) => sum + c.user_spent, 0),
      partner_budget: categoryViews.reduce(
        (sum, c) => sum + c.partner_budget,
        0
      ),
      partner_spent: categoryViews.reduce((sum, c) => sum + c.partner_spent, 0),
      shared_budget: categoryViews.reduce((sum, c) => sum + c.shared_budget, 0),
      categories: categoryViews,
    };
    summary.total_remaining = summary.total_budget - summary.total_spent;

    return NextResponse.json({
      summary,
      hasPartner: !!partnerId,
      accounts: accounts || [],
    });
  } catch (error) {
    console.error("Budget allocations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch budget data" },
      { status: 500 }
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
      { status: 400 }
    );
  }

  // Upsert: update if exists, insert if not
  const { data, error } = await supabase
    .from("budget_allocations")
    .upsert(
      {
        user_id: user.id,
        category_id,
        subcategory_id,
        account_id,
        assigned_to,
        monthly_budget,
        budget_month,
      },
      {
        onConflict:
          "user_id,category_id,subcategory_id,assigned_to,budget_month",
      }
    )
    .select()
    .single();

  if (error) {
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
      { status: 400 }
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
