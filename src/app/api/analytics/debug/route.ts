import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/debug
 * Diagnostic endpoint to trace data flow issues.
 */
export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    diagnostics.userId = user.id;

    // 1) Household
    const { data: householdLink, error: hlErr } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .maybeSingle();
    diagnostics.household = { data: householdLink, error: hlErr?.message };

    const partnerId = householdLink
      ? householdLink.owner_user_id === user.id
        ? householdLink.partner_user_id
        : householdLink.owner_user_id
      : null;
    diagnostics.partnerId = partnerId;

    // 2) Accounts
    const userIds = partnerId ? [user.id, partnerId] : [user.id];
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, name, type, user_id")
      .in("user_id", userIds);
    diagnostics.accounts = {
      count: accounts?.length ?? 0,
      error: accErr?.message,
      list: accounts?.map((a) => ({
        id: a.id.slice(0, 8),
        name: a.name,
        type: a.type,
      })),
    };

    if (!accounts || accounts.length === 0) {
      diagnostics.issue = "NO_ACCOUNTS";
      return NextResponse.json(diagnostics);
    }

    const accountIds = accounts.map((a) => a.id);

    // 3) Transactions (last 6 months)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = now.toISOString().slice(0, 10);
    diagnostics.dateRange = { startStr, endStr };

    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select(
        "id, amount, date, account_id, user_id, is_private, is_debt_return",
      )
      .in("account_id", accountIds)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: false })
      .limit(20);
    diagnostics.transactions = {
      count: txs?.length ?? 0,
      error: txErr?.message,
      sample: txs?.slice(0, 5).map((t) => ({
        date: t.date,
        amount: t.amount,
        accId: t.account_id.slice(0, 8),
        userId: t.user_id.slice(0, 8),
      })),
    };

    // 4) Categories with classification
    const { data: cats, error: catErr } = await supabase
      .from("user_categories")
      .select("id, name, color, classification")
      .eq("user_id", user.id)
      .eq("visible", true)
      .limit(10);
    diagnostics.categories = {
      count: cats?.length ?? 0,
      error: catErr?.message,
      sample: cats
        ?.slice(0, 5)
        .map((c) => ({ name: c.name, classification: c.classification })),
    };

    // 5) Categories WITHOUT classification (test if column exists)
    const { data: cats2, error: catErr2 } = await supabase
      .from("user_categories")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("visible", true)
      .limit(5);
    diagnostics.categoriesWithoutClassification = {
      count: cats2?.length ?? 0,
      error: catErr2?.message,
    };

    // 6) Recurring
    const { data: rec, error: recErr } = await supabase
      .from("recurring_payments")
      .select("id, name")
      .in("account_id", accountIds)
      .eq("is_active", true)
      .limit(5);
    diagnostics.recurring = { count: rec?.length ?? 0, error: recErr?.message };

    // 7) Debts
    const { data: debts, error: debtErr } = await supabase
      .from("debts")
      .select("id")
      .eq("user_id", user.id)
      .limit(5);
    diagnostics.debts = { count: debts?.length ?? 0, error: debtErr?.message };

    // 8) Account balances
    const { data: bal, error: balErr } = await supabase
      .from("account_balances")
      .select("account_id, balance")
      .in("account_id", accountIds.slice(0, 3));
    diagnostics.balances = { count: bal?.length ?? 0, error: balErr?.message };

    diagnostics.issue = "NONE";
    return NextResponse.json(diagnostics);
  } catch (error: any) {
    diagnostics.issue = "EXCEPTION";
    diagnostics.error = error.message;
    diagnostics.stack = error.stack?.split("\n").slice(0, 5);
    return NextResponse.json(diagnostics, { status: 500 });
  }
}
