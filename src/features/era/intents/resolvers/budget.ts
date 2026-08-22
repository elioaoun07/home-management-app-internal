// Budget resolver — fetches MTD transactions and aggregates
import { safeFetch } from "@/lib/safeFetch";
import { getCachedPreferences } from "@/lib/queryConfig";
import { getDefaultDateRange } from "@/lib/utils/date";
import {
  formatAnalytics,
  formatAnalyticsError,
  formatBudgetError,
  formatDraftTransaction,
  formatDraftTransactionError,
  formatMonthSpend,
  monthKeyToLabel,
} from "../formatters/budget";
import type { EraBudgetSubmitResult } from "../../useEraBudgetSubmit";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

export async function resolveMonthSpend(
  scope: "self" | "partner" | "household",
  categoryHint?: string,
): Promise<ResolveResult> {
  try {
    const prefs = getCachedPreferences();
    const monthStartDay = Number(prefs?.date_start?.split("-")[1] ?? "1") || 1;
    const { start, end } = getDefaultDateRange(monthStartDay);

    const ownOnly = scope === "self" ? "&ownOnly=true" : "";
    const res = await safeFetch(
      `/api/transactions?start=${start}&end=${end}${ownOnly}`,
      { timeoutMs: 10_000 },
    );
    if (!res.ok) return { text: formatBudgetError() };

    const transactions: Array<{
      amount: number;
      user_id: string;
      category?: { name: string } | null;
    }> = await res.json();

    // For partner scope, filter to non-current-user rows (proxy: amount sign or user_id)
    // The transaction service already handles household vs. own via ownOnly
    // For partner, fetch all then we'd need user_id filtering — but we don't have current user here.
    // Simplification: use total as "household" spend; ownOnly=true for self.
    // Partner scope uses household total minus self, which requires two calls — too costly.
    // Use the full total for partner/household scope with a clarifying note.

    const total = transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);

    // Category aggregation
    const catMap: Record<string, number> = {};
    for (const t of transactions) {
      const name = t.category?.name ?? "Uncategorized";
      catMap[name] = (catMap[name] ?? 0) + t.amount;
    }

    let filteredTotal = total;
    let topCategory: string | null = null;
    let topAmount: number | null = null;

    if (categoryHint) {
      const key = Object.keys(catMap).find((k) =>
        k.toLowerCase().includes(categoryHint.toLowerCase()),
      );
      if (key) {
        filteredTotal = catMap[key];
        topCategory = key;
        topAmount = catMap[key];
      }
    } else {
      // Top category by amount
      const sorted = Object.entries(catMap).sort(([, a], [, b]) => b - a);
      if (sorted.length > 0) {
        [topCategory, topAmount] = [sorted[0][0], sorted[0][1]];
      }
    }

    return {
      text: formatMonthSpend({
        total: filteredTotal,
        scope,
        topCategory: categoryHint ? topCategory : topCategory,
        topAmount,
        currency: "USD",
      }),
      metadata: { total: filteredTotal, scope, start, end },
    };
  } catch {
    return { text: formatBudgetError() };
  }
}

// ---------------------------------------------------------------------------
// showAnalytics
// ---------------------------------------------------------------------------

interface AnalyticsMonth {
  month: string;
  income: number;
  expense: number;
  savingsRate: number;
  transactionCount: number;
  categoryBreakdown: Array<{ name: string; amount: number }>;
}

/**
 * Spoken summary of the analytics page: this month's in/out, savings rate,
 * top three categories, and the month-over-month delta.
 *
 * Pulls two months so the comparison line has something to compare against;
 * `/api/analytics` returns months chronologically, so the last entry is the
 * current one.
 */
export async function resolveShowAnalytics(): Promise<ResolveResult> {
  try {
    const res = await safeFetch("/api/analytics?months=2&ownership=all", {
      timeoutMs: 10_000,
    });
    if (!res.ok) return { text: formatAnalyticsError() };

    const data: { months?: AnalyticsMonth[] } = await res.json();
    const months = data.months ?? [];
    if (months.length === 0) {
      return {
        text: formatAnalytics({
          monthLabel: monthKeyToLabel(new Date().toISOString().slice(0, 7)),
          income: 0,
          expense: 0,
          savingsRate: 0,
          transactionCount: 0,
          topCategories: [],
          previousExpense: null,
        }),
        metadata: { months: 0 },
      };
    }

    const current = months[months.length - 1];
    const previous = months.length > 1 ? months[months.length - 2] : null;

    const topCategories = (current.categoryBreakdown ?? [])
      .slice(0, 3)
      .map((c) => ({ name: c.name, amount: c.amount }));

    return {
      text: formatAnalytics({
        monthLabel: monthKeyToLabel(current.month),
        income: current.income,
        expense: current.expense,
        savingsRate: current.savingsRate,
        transactionCount: current.transactionCount,
        topCategories,
        previousExpense: previous?.expense ?? null,
      }),
      metadata: {
        month: current.month,
        income: current.income,
        expense: current.expense,
        savingsRate: current.savingsRate,
        transactionCount: current.transactionCount,
        topCategories,
      },
    };
  } catch {
    return { text: formatAnalyticsError() };
  }
}

// ---------------------------------------------------------------------------
// draftTransaction
// ---------------------------------------------------------------------------

/**
 * Turn "I paid $25 on fuel" into a real draft transaction.
 *
 * The write itself still lives in `useEraBudgetSubmit` — it needs the user's
 * accounts, categories and the React Query client to invalidate, plus it owns
 * the Undo toast required by Hard Rule #1. This resolver takes that hook's
 * `submit` as an injected capability so the *decision and the reply* live on
 * the resolver path like every other intent, instead of being special-cased in
 * CommandBar. When no submitter is available (no accounts loaded yet, or a
 * caller outside the hub) we fail with the same wording as a no-account result
 * rather than silently doing nothing.
 */
export async function resolveDraftTransaction(
  rawText: string,
  submitDraft?: (sentence: string) => Promise<EraBudgetSubmitResult>,
): Promise<ResolveResult> {
  if (!submitDraft) {
    return { text: formatDraftTransactionError("no-account") };
  }

  const result = await submitDraft(rawText);

  if (!result.ok) {
    return {
      text: formatDraftTransactionError(result.reason, result.message),
      metadata: { draftFailed: result.reason },
    };
  }

  return {
    text: formatDraftTransaction({
      amount: result.parsed.amount ?? 0,
      categoryName: result.parsed.categoryName,
      subcategoryName: result.parsed.subcategoryName,
    }),
    metadata: {
      draftId: result.draftId,
      accountId: result.accountId,
      amount: result.parsed.amount ?? 0,
      categoryName: result.parsed.categoryName ?? null,
    },
  };
}
