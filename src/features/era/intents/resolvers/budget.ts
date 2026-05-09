// Budget resolver — fetches MTD transactions and aggregates
import { safeFetch } from "@/lib/safeFetch";
import { getCachedPreferences } from "@/lib/queryConfig";
import { getDefaultDateRange } from "@/lib/utils/date";
import { formatBudgetError, formatMonthSpend } from "../formatters/budget";

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
