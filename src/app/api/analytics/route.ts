import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics
 * Returns pre-aggregated monthly financial data for the analytics dashboard.
 * Query params:
 *  - months: number of months to look back (default 6, max 24)
 *  - accountId: optional filter to a single account
 *  - ownership: "mine" | "partner" | "all" (default "all")
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
    const monthsBack = Math.min(
      Math.max(parseInt(searchParams.get("months") || "6") || 6, 1),
      24,
    );
    const accountIdFilter = searchParams.get("accountId");
    const ownership = searchParams.get("ownership") || "all";

    // --- Household resolution ---
    const { data: householdLink } = await supabase
      .from("household_links")
      .select("*")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .maybeSingle();

    const partnerId = householdLink
      ? householdLink.owner_user_id === user.id
        ? householdLink.partner_user_id
        : householdLink.owner_user_id
      : null;

    // --- Accounts ---
    const userIds =
      ownership === "mine"
        ? [user.id]
        : ownership === "partner" && partnerId
          ? [partnerId]
          : partnerId
            ? [user.id, partnerId]
            : [user.id];

    let accountsQuery = supabase
      .from("accounts")
      .select("id, name, type, user_id")
      .in("user_id", userIds);

    if (accountIdFilter) {
      accountsQuery = accountsQuery.eq("id", accountIdFilter);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;
    console.log("[analytics] accounts query:", {
      count: accounts?.length,
      error: accountsError,
      userIds,
    });
    const accountList = accounts || [];
    const accountIds = accountList.map((a) => a.id);

    if (accountIds.length === 0) {
      console.log("[analytics] No accounts found, returning empty");
      return NextResponse.json(emptyResponse(!!partnerId));
    }

    const accountMap = new Map(accountList.map((a) => [a.id, a]));
    const expenseAccountIds = accountList
      .filter((a) => a.type === "expense")
      .map((a) => a.id);
    const incomeAccountIds = accountList
      .filter((a) => a.type === "income")
      .map((a) => a.id);
    const savingAccountIds = accountList
      .filter((a) => a.type === "saving")
      .map((a) => a.id);

    // --- Date range ---
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - monthsBack + 1,
      1,
    );
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = now.toISOString().slice(0, 10);
    console.log("[analytics] date range:", { startStr, endStr, monthsBack });

    // --- Fetch transactions ---
    const { data: rawTxs, error: txError } = await supabase
      .from("transactions")
      .select(
        "id, amount, date, account_id, category_id, subcategory_id, user_id, is_private, description, is_debt_return",
      )
      .in("account_id", accountIds)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: true });
    console.log("[analytics] transactions:", {
      rawCount: rawTxs?.length,
      error: txError,
    });

    const transactions = (rawTxs || []).filter((t) => {
      // Filter out partner's private transactions
      if (t.user_id !== user.id && t.is_private) return false;
      return true;
    });

    // --- Fetch categories (with classification for 50/30/20) ---
    const catUserIds =
      partnerId && ownership !== "partner"
        ? [user.id]
        : partnerId && ownership === "partner"
          ? [partnerId]
          : [user.id];

    // Try with classification column, fall back without it
    let categories: any[] | null = null;
    const { data: catsWithClass, error: catError } = await supabase
      .from("user_categories")
      .select("id, name, color, parent_id, account_id, classification")
      .in("user_id", catUserIds)
      .eq("visible", true);

    if (catError) {
      // classification column might not exist; retry without it
      console.warn(
        "[analytics] categories query failed, retrying without classification:",
        catError.message,
      );
      const { data: catsBasic } = await supabase
        .from("user_categories")
        .select("id, name, color, parent_id, account_id")
        .in("user_id", catUserIds)
        .eq("visible", true);
      categories = catsBasic;
    } else {
      categories = catsWithClass;
    }

    const catMap = new Map(
      (categories || []).map((c) => [
        c.id,
        {
          name: c.name,
          color: c.color,
          parentId: c.parent_id,
          classification: c.classification as "need" | "want" | "saving" | null,
        },
      ]),
    );

    // --- Fetch recurring payments ---
    let recurringQuery = supabase
      .from("recurring_payments")
      .select(
        "id, name, amount, recurrence_type, account_id, category_id, is_active",
      )
      .in("account_id", accountIds)
      .eq("is_active", true);

    const { data: recurringPayments } = await recurringQuery;

    // --- Fetch debts ---
    let debtsQuery = supabase
      .from("debts")
      .select(
        "id, debtor_name, original_amount, returned_amount, status, direction",
      )
      .eq("user_id", user.id);

    const { data: debts } = await debtsQuery;

    // --- Aggregate monthly data ---
    const monthlyMap = new Map<
      string,
      {
        income: number;
        expense: number;
        savings: number;
        txCount: number;
        categoryBreakdown: Map<
          string,
          {
            name: string;
            amount: number;
            color: string;
            classification: string | null;
          }
        >;
        dailyTotals: Map<string, { income: number; expense: number }>;
        myExpense: number;
        partnerExpense: number;
      }
    >();

    for (const tx of transactions) {
      const monthKey = tx.date.slice(0, 7); // YYYY-MM
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          income: 0,
          expense: 0,
          savings: 0,
          txCount: 0,
          categoryBreakdown: new Map(),
          dailyTotals: new Map(),
          myExpense: 0,
          partnerExpense: 0,
        });
      }
      const m = monthlyMap.get(monthKey)!;
      m.txCount++;

      const acctType = accountMap.get(tx.account_id)?.type;
      const amount = Number(tx.amount);

      // Real income (exclude debt returns)
      if (acctType === "income" && !tx.is_debt_return) {
        m.income += amount;
      } else if (acctType === "expense") {
        m.expense += amount;

        // Per-user expense tracking
        if (tx.user_id === user.id) {
          m.myExpense += amount;
        } else {
          m.partnerExpense += amount;
        }
      } else if (acctType === "saving") {
        m.savings += amount;
      }

      // Category breakdown (expense only)
      if (acctType === "expense" && tx.category_id) {
        const catId = tx.subcategory_id || tx.category_id;
        const catInfo = catMap.get(catId) || catMap.get(tx.category_id);
        if (catInfo) {
          const existing = m.categoryBreakdown.get(catInfo.name);
          if (existing) {
            existing.amount += amount;
          } else {
            m.categoryBreakdown.set(catInfo.name, {
              name: catInfo.name,
              amount: amount,
              color: catInfo.color || "#6366f1",
              classification: catInfo.classification,
            });
          }
        }
      }

      // Daily totals for cash flow
      const dayKey = tx.date;
      const dayTotals = m.dailyTotals.get(dayKey) || {
        income: 0,
        expense: 0,
      };
      if (acctType === "income" && !tx.is_debt_return) {
        dayTotals.income += amount;
      } else if (acctType === "expense") {
        dayTotals.expense += amount;
      }
      m.dailyTotals.set(dayKey, dayTotals);
    }

    // --- Build months array sorted chronologically ---
    const months = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        income: round(data.income),
        expense: round(data.expense),
        savings: round(data.savings),
        savingsRate:
          data.income > 0
            ? round(((data.income - data.expense) / data.income) * 100)
            : 0,
        transactionCount: data.txCount,
        categoryBreakdown: Array.from(data.categoryBreakdown.values())
          .sort((a, b) => b.amount - a.amount)
          .map((c) => ({
            name: c.name,
            amount: round(c.amount),
            color: c.color,
            classification: c.classification,
          })),
        dailyTotals: Array.from(data.dailyTotals.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, totals]) => ({
            date,
            income: round(totals.income),
            expense: round(totals.expense),
          })),
        myExpense: round(data.myExpense),
        partnerExpense: round(data.partnerExpense),
      }));

    // --- 50/30/20 Needs/Wants/Savings ---
    // Current month only (or latest month with data)
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthData = monthlyMap.get(currentMonthKey);
    let needsWantsSavings = { needs: 0, wants: 0, savings: 0, unclassified: 0 };

    if (currentMonthData) {
      for (const [, cat] of currentMonthData.categoryBreakdown) {
        switch (cat.classification) {
          case "need":
            needsWantsSavings.needs += cat.amount;
            break;
          case "want":
            needsWantsSavings.wants += cat.amount;
            break;
          case "saving":
            needsWantsSavings.savings += cat.amount;
            break;
          default:
            needsWantsSavings.unclassified += cat.amount;
        }
      }
      // Add saving account deposits to savings bucket
      needsWantsSavings.savings += currentMonthData.savings;
    }
    needsWantsSavings = {
      needs: round(needsWantsSavings.needs),
      wants: round(needsWantsSavings.wants),
      savings: round(needsWantsSavings.savings),
      unclassified: round(needsWantsSavings.unclassified),
    };

    // --- Recurring summary ---
    const recurringList = (recurringPayments || []).map((r) => {
      const monthly =
        r.recurrence_type === "yearly"
          ? Number(r.amount) / 12
          : r.recurrence_type === "weekly"
            ? Number(r.amount) * 4.33
            : r.recurrence_type === "daily"
              ? Number(r.amount) * 30
              : Number(r.amount);
      return {
        id: r.id,
        name: r.name,
        amount: round(Number(r.amount)),
        monthlyEquivalent: round(monthly),
        recurrenceType: r.recurrence_type,
      };
    });

    const totalMonthlyRecurring = recurringList.reduce(
      (s, r) => s + r.monthlyEquivalent,
      0,
    );

    // --- Debt summary ---
    const openDebts = (debts || []).filter((d) => d.status === "open");
    const totalOwed = openDebts
      .filter((d) => d.direction === "i_owe")
      .reduce(
        (s, d) =>
          s + Number(d.original_amount) - Number(d.returned_amount || 0),
        0,
      );
    const totalOwedToYou = openDebts
      .filter((d) => d.direction === "they_owe")
      .reduce(
        (s, d) =>
          s + Number(d.original_amount) - Number(d.returned_amount || 0),
        0,
      );

    // --- Account balances ---
    const accountBalances = [];
    for (const acct of accountList) {
      const { data: balData } = await supabase
        .from("account_balances")
        .select("balance")
        .eq("account_id", acct.id)
        .maybeSingle();

      accountBalances.push({
        id: acct.id,
        name: acct.name,
        type: acct.type,
        userId: acct.user_id,
        currentBalance: balData?.balance ?? 0,
      });
    }

    console.log("[analytics] final:", {
      monthsCount: months.length,
      monthKeys: months.map((m) => m.month),
      firstMonth: months[0]
        ? {
            income: months[0].income,
            expense: months[0].expense,
            txCount: months[0].transactionCount,
          }
        : null,
    });

    return NextResponse.json({
      months,
      needsWantsSavings,
      recurring: {
        totalMonthly: round(totalMonthlyRecurring),
        items: recurringList,
      },
      debts: {
        totalOwed: round(totalOwed),
        totalOwedToYou: round(totalOwedToYou),
        openCount: openDebts.length,
      },
      accounts: accountBalances,
      hasPartner: !!partnerId,
      currentUserId: user.id,
    });
  } catch (error: any) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics", detail: error?.message },
      { status: 500 },
    );
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyResponse(hasPartner: boolean) {
  return {
    months: [],
    needsWantsSavings: { needs: 0, wants: 0, savings: 0, unclassified: 0 },
    recurring: { totalMonthly: 0, items: [] },
    debts: { totalOwed: 0, totalOwedToYou: 0, openCount: 0 },
    accounts: [],
    hasPartner,
    currentUserId: "",
  };
}
