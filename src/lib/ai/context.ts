// src/lib/ai/context.ts
//
// Face-scoped context assembly for AI calls (WP-10). `fetchBudgetContext` +
// `fetchMonthlyTrend` were extracted verbatim from `api/ai-chat/route.ts` —
// Next.js route files may only export HTTP method handlers, so context
// assembly meant for reuse has to live in `lib`, not the route. Behavior is
// unchanged; this is a move, not a rewrite.
//
// `assembleScheduleContext` is new (Slice 4 / ERA "Ask AI") — it gives the
// schedule face's AI handoff the same kind of typed, queried context the
// budget face already had, including NFC tag state, so a request like
// "remind me when I arrive home" can be answered with a real prerequisite
// proposal instead of the model inventing a plausible-sounding tag name.

import type { BudgetContext, MonthlyTrendPoint } from "./gemini";
import { supabaseServer } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;

/**
 * Fetch budget context for the current user (includes last month data).
 */
export async function fetchBudgetContext(
  supabase: SupabaseServerClient,
  userId: string,
  opts: { includeTrend?: boolean } = {},
): Promise<BudgetContext> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = `${currentMonth}-01`;
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  // Calculate last month dates
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthStart = `${lastMonth}-01`;
  const lastMonthEnd = new Date(
    lastMonthDate.getFullYear(),
    lastMonthDate.getMonth() + 1,
    0,
  )
    .toISOString()
    .slice(0, 10);

  // Fetch user's accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, type")
    .eq("user_id", userId);

  const accountIds = (accounts || []).map((a) => a.id);

  // Separate expense and income account IDs for proper categorization
  const expenseAccountIds = new Set(
    (accounts || []).filter((a) => a.type === "expense").map((a) => a.id),
  );
  const incomeAccountIds = new Set(
    (accounts || []).filter((a) => a.type === "income").map((a) => a.id),
  );

  if (accountIds.length === 0) {
    return {
      totalBudget: 0,
      totalSpent: 0,
      totalRemaining: 0,
      categories: [],
      recentTransactions: [],
      currentMonth,
    };
  }

  // Fetch account balances (try account_balances table first)
  const accountBalances: Record<string, number> = {};
  try {
    const { data: balances } = await supabase
      .from("account_balances")
      .select("account_id, balance")
      .in("account_id", accountIds);

    if (balances) {
      balances.forEach((b) => {
        accountBalances[b.account_id] = b.balance;
      });
    }
  } catch (error) {
    console.warn("Could not fetch account balances:", error);
  }

  const accountsWithBalances = (accounts || []).map((a) => ({
    name: a.name,
    type: a.type,
    balance: accountBalances[a.id] || 0,
  }));

  // Fetch recurring payments
  let recurringPayments: BudgetContext["recurringPayments"] = [];
  try {
    const { data: recurring } = await supabase
      .from("recurring_payments")
      .select("name, amount, recurrence_type, next_due_date")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (recurring) {
      recurringPayments = recurring.map((r) => ({
        name: r.name,
        amount: r.amount,
        recurrence: r.recurrence_type,
        nextDue: r.next_due_date,
      }));
    }
  } catch (error) {
    console.warn("Could not fetch recurring payments:", error);
  }

  // Fetch future purchases
  let futurePurchases: BudgetContext["futurePurchases"] = [];
  try {
    const { data: future } = await supabase
      .from("future_purchases")
      .select("name, target_amount, current_saved, target_date")
      .eq("user_id", userId)
      .neq("status", "cancelled");

    if (future) {
      futurePurchases = future.map((f) => ({
        name: f.name,
        targetAmount: f.target_amount,
        saved: f.current_saved,
        targetDate: f.target_date,
      }));
    }
  } catch (error) {
    console.warn("Could not fetch future purchases:", error);
  }

  // Fetch draft transactions
  let draftTransactions: BudgetContext["draftTransactions"] = [];
  try {
    const { data: drafts } = await supabase
      .from("transactions")
      .select("voice_transcript, confidence_score")
      .eq("user_id", userId)
      .eq("is_draft", true);

    if (drafts) {
      draftTransactions = drafts.map((d) => ({
        transcript: d.voice_transcript || "Unknown draft",
        confidence: d.confidence_score || 0,
      }));
    }
  } catch (error) {
    console.warn("Could not fetch draft transactions:", error);
  }

  // Fetch budget allocations
  const { data: allocations } = await supabase
    .from("budget_allocations")
    .select("monthly_budget, category_id")
    .eq("user_id", userId)
    .or(`budget_month.eq.${currentMonth},budget_month.is.null`);

  // Fetch categories
  const { data: categories } = await supabase
    .from("user_categories")
    .select("id, name")
    .eq("user_id", userId)
    .is("parent_id", null);

  // Fetch current month transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, category_id, description, date, account_id")
    .in("account_id", accountIds)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  // Fetch LAST MONTH transactions
  const { data: lastMonthTransactions } = await supabase
    .from("transactions")
    .select("amount, category_id, description, date, account_id")
    .in("account_id", accountIds)
    .gte("date", lastMonthStart)
    .lte("date", lastMonthEnd)
    .order("date", { ascending: false });

  // Separate expense and income transactions (current month)
  const expenseTransactions = (transactions || []).filter((tx) =>
    expenseAccountIds.has(tx.account_id),
  );
  const incomeTransactions = (transactions || []).filter((tx) =>
    incomeAccountIds.has(tx.account_id),
  );

  // Separate expense and income transactions (last month)
  const lastMonthExpenseTransactions = (lastMonthTransactions || []).filter(
    (tx) => expenseAccountIds.has(tx.account_id),
  );
  const lastMonthIncomeTransactions = (lastMonthTransactions || []).filter(
    (tx) => incomeAccountIds.has(tx.account_id),
  );

  // Calculate spending by category (current month - EXPENSES ONLY)
  const categorySpending: Record<string, number> = {};
  expenseTransactions.forEach((tx) => {
    if (tx.category_id) {
      categorySpending[tx.category_id] =
        (categorySpending[tx.category_id] || 0) + tx.amount;
    }
  });

  // Calculate spending by category (last month - EXPENSES ONLY)
  const lastMonthCategorySpending: Record<string, number> = {};
  lastMonthExpenseTransactions.forEach((tx) => {
    if (tx.category_id) {
      lastMonthCategorySpending[tx.category_id] =
        (lastMonthCategorySpending[tx.category_id] || 0) + tx.amount;
    }
  });

  // Calculate total income (current month)
  const totalIncome = incomeTransactions.reduce(
    (sum, tx) => sum + tx.amount,
    0,
  );

  // Calculate total income (last month)
  const lastMonthTotalIncome = lastMonthIncomeTransactions.reduce(
    (sum, tx) => sum + tx.amount,
    0,
  );

  // Build category budget info
  const categoryBudgets: Record<string, number> = {};
  (allocations || []).forEach((a) => {
    if (a.category_id) {
      categoryBudgets[a.category_id] =
        (categoryBudgets[a.category_id] || 0) + a.monthly_budget;
    }
  });

  // Create category name mapping
  const categoryNames: Record<string, string> = {};
  (categories || []).forEach((c) => {
    categoryNames[c.id] = c.name;
  });

  // Build categories array (current month)
  const categoriesArray = (categories || []).map((cat) => ({
    name: cat.name,
    budget: categoryBudgets[cat.id] || 0,
    spent: categorySpending[cat.id] || 0,
    remaining: (categoryBudgets[cat.id] || 0) - (categorySpending[cat.id] || 0),
  }));

  // Build last month categories array
  const lastMonthCategoriesArray = (categories || [])
    .filter((cat) => lastMonthCategorySpending[cat.id] > 0)
    .map((cat) => ({
      name: cat.name,
      spent: lastMonthCategorySpending[cat.id] || 0,
    }));

  // Multi-month income/expense trend (analysis mode only — one extra query).
  let monthlyTrend: MonthlyTrendPoint[] | undefined;
  if (opts.includeTrend) {
    monthlyTrend = await fetchMonthlyTrend(
      supabase,
      accountIds,
      expenseAccountIds,
      incomeAccountIds,
      now,
      6,
    );
  }

  // Calculate totals (EXPENSES ONLY for spending)
  const totalBudget = categoriesArray.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = categoriesArray.reduce((sum, c) => sum + c.spent, 0);
  const lastMonthTotalSpent = lastMonthCategoriesArray.reduce(
    (sum, c) => sum + c.spent,
    0,
  );

  // Format recent transactions (current month - EXPENSES ONLY with clear labeling)
  const recentExpenseTransactions = expenseTransactions
    .slice(0, 10)
    .map((tx) => ({
      description: tx.description || "Unknown",
      amount: tx.amount,
      category: categoryNames[tx.category_id] || "Uncategorized",
      date: tx.date,
    }));

  // Format recent income transactions (current month)
  const recentIncomeTransactions = incomeTransactions.slice(0, 5).map((tx) => ({
    description: tx.description || "Unknown",
    amount: tx.amount,
    category: categoryNames[tx.category_id] || "Income",
    date: tx.date,
  }));

  // Format last month transactions (EXPENSES ONLY)
  const lastMonthFormattedTransactions = lastMonthExpenseTransactions
    .slice(0, 15)
    .map((tx) => ({
      description: tx.description || "Unknown",
      amount: tx.amount,
      category: categoryNames[tx.category_id] || "Uncategorized",
      date: tx.date,
    }));

  // Format last month income transactions
  const lastMonthFormattedIncomeTransactions = lastMonthIncomeTransactions
    .slice(0, 5)
    .map((tx) => ({
      description: tx.description || "Unknown",
      amount: tx.amount,
      category: categoryNames[tx.category_id] || "Income",
      date: tx.date,
    }));

  return {
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
    categories: categoriesArray,
    recentTransactions: recentExpenseTransactions,
    currentMonth,
    // Include income data
    totalIncome,
    recentIncomeTransactions,
    // Include last month data
    lastMonth: {
      month: lastMonth,
      totalSpent: lastMonthTotalSpent,
      totalIncome: lastMonthTotalIncome,
      categories: lastMonthCategoriesArray,
      transactions: lastMonthFormattedTransactions,
      incomeTransactions: lastMonthFormattedIncomeTransactions,
    },
    recurringPayments,
    futurePurchases,
    accounts: accountsWithBalances,
    draftTransactions,
    monthlyTrend,
  };
}

/**
 * Aggregate income/expense/net per month over the last `monthsBack` months.
 * Empty months are seeded so the trend chart shows a continuous series.
 */
async function fetchMonthlyTrend(
  supabase: SupabaseServerClient,
  accountIds: string[],
  expenseAccountIds: Set<string>,
  incomeAccountIds: Set<string>,
  now: Date,
  monthsBack: number,
): Promise<MonthlyTrendPoint[]> {
  const windowStart = new Date(
    now.getFullYear(),
    now.getMonth() - (monthsBack - 1),
    1,
  );
  const startStr = windowStart.toISOString().slice(0, 10);

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount, date, account_id")
    .in("account_id", accountIds)
    .gte("date", startStr)
    .order("date", { ascending: true });

  // Seed a bucket per month so gaps render as zero, not as missing points.
  const buckets = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - (monthsBack - 1) + i,
      1,
    );
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { income: 0, expense: 0 });
  }

  for (const tx of txs || []) {
    const key = String(tx.date).slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (expenseAccountIds.has(tx.account_id)) bucket.expense += tx.amount;
    else if (incomeAccountIds.has(tx.account_id)) bucket.income += tx.amount;
  }

  return Array.from(buckets.entries()).map(([period, v]) => ({
    period,
    income: v.income,
    expense: v.expense,
    net: v.income - v.expense,
  }));
}

// ---------------------------------------------------------------------------
// Schedule context (Slice 4 / ERA "Ask AI") — new
// ---------------------------------------------------------------------------

export interface ScheduleContextNfcTag {
  id: string;
  label: string;
  states: string[];
  currentState: string | null;
}

export interface ScheduleContextItem {
  title: string;
  status: string;
  dueAt: string | null;
}

export interface ScheduleContext {
  upcoming: ScheduleContextItem[];
  overdueCount: number;
  nfcTags: ScheduleContextNfcTag[];
}

/**
 * Schedule-face context for the AI handoff: a short list of upcoming/overdue
 * items (titles + due dates only — no need to hand the model everything
 * `get_schedule_bundle` returns) plus every NFC tag the household has
 * defined, with its declared states and live `current_state`. This is what
 * lets "remind me when I arrive home" resolve to a REAL tag id instead of
 * the model inventing a plausible one — the proposal schema (see
 * `eraAskProposal.ts`) validates the model's chosen tag id against this
 * exact list and falls back to prose if it doesn't match.
 */
/**
 * `reminder_details`/`event_details` come back from Supabase as either a
 * single joined row or an array of one, depending on how the client infers
 * cardinality without generated types for this ad-hoc select — so read both
 * shapes defensively instead of asserting one with `as any`.
 */
function firstDueTimestamp(item: {
  reminder_details?: { due_at: string | null } | { due_at: string | null }[] | null;
  event_details?: { start_at: string | null } | { start_at: string | null }[] | null;
}): string | null {
  const reminder = Array.isArray(item.reminder_details)
    ? item.reminder_details[0]
    : item.reminder_details;
  if (reminder?.due_at) return reminder.due_at;

  const event = Array.isArray(item.event_details) ? item.event_details[0] : item.event_details;
  return event?.start_at ?? null;
}

export async function fetchScheduleContext(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<ScheduleContext> {
  const now = new Date().toISOString();
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: items } = await supabase
    .from("items")
    .select(
      `
      title, status,
      reminder_details(due_at),
      event_details(start_at)
    `,
    )
    .eq("user_id", userId)
    .not("status", "in", `("completed","cancelled")`)
    .is("deleted_at", null)
    .is("archived_at", null)
    .limit(50);

  const upcoming: ScheduleContextItem[] = [];
  let overdueCount = 0;

  for (const item of items ?? []) {
    const dueAt = firstDueTimestamp(item);
    if (dueAt && dueAt < now) {
      overdueCount++;
      continue;
    }
    if (!dueAt || dueAt <= soon) {
      upcoming.push({ title: item.title, status: item.status, dueAt });
    }
  }

  const { data: tags } = await supabase
    .from("nfc_tags")
    .select("id, label, states, current_state")
    .eq("user_id", userId)
    .eq("is_active", true);

  const nfcTags: ScheduleContextNfcTag[] = (tags ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    states: t.states ?? [],
    currentState: t.current_state ?? null,
  }));

  return { upcoming: upcoming.slice(0, 20), overdueCount, nfcTags };
}
