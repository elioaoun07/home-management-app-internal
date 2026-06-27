/**
 * Budget forecast core — outlier-aware per-category history aggregation and a
 * deterministic statistical fallback for AI budget suggestions.
 *
 * Used by `src/app/api/budget-allocations/ai-suggest/route.ts`:
 *  - `aggregateCleanMonthlyByCategory` strips one-off spikes / rare charges
 *    (via `detectTransactionOutliers`) before the spend history is fed to the
 *    LLM, so a single large purchase can't inflate a category's baseline.
 *  - `buildStatisticalSuggestion` produces a full suggestion from the cleaned
 *    history alone — the fallback used when Gemini is unavailable or fails.
 *  - `computeCategoryBaselines` + `softClampSuggestions` keep the LLM's numbers
 *    anchored to each category's typical (outlier-free) monthly spend.
 *
 * Pure & framework-free so it can be unit-tested in isolation.
 */

import {
  detectTransactionOutliers,
  type RecurringHint,
} from "@/lib/utils/anomalyDetection";
import type { AiCategorySuggestion } from "@/types/budgetAllocation";

/** A historical transaction, already resolved to the spending category/subcategory NAME. */
export type ForecastTransaction = {
  id: string;
  amount: number;
  /** Leaf spend bucket name (subcategory name when present, else category name). */
  category: string;
  description?: string | null;
  /** ISO date `YYYY-MM-DD`. */
  date: string;
};

/** A budgetable category with its (merged) subcategories. */
export type ForecastCategory = {
  name: string;
  primaryId: string;
  subcategories: { name: string; primaryId: string }[];
};

export type CleanAggregation = {
  /** `'YYYY-MM'` → { spendBucketName → amount } over outlier-stripped transactions. */
  monthly: Record<string, Record<string, number>>;
  /** Transaction ids excluded as outliers. */
  excludedIds: Set<string>;
  /** Count of excluded transactions (for UI transparency). */
  excludedCount: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aggregate transactions into monthly per-bucket spend, excluding statistically
 * detected outliers (spikes within an established category, and material
 * charges in rarely-used categories). Registered recurring payments are passed
 * as hints so legitimate recurring charges are never treated as outliers.
 */
export function aggregateCleanMonthlyByCategory(
  txs: ForecastTransaction[],
  recurringHints: RecurringHint[] = [],
): CleanAggregation {
  const outliers = detectTransactionOutliers(
    txs.map((t) => ({
      id: t.id,
      amount: t.amount,
      category: t.category,
      description: t.description ?? null,
      date: t.date,
    })),
    { recurringHints },
  );
  const excludedIds = new Set(outliers.map((o) => o.transactionId));

  const monthly: Record<string, Record<string, number>> = {};
  for (const t of txs) {
    if (excludedIds.has(t.id)) continue;
    if (!t.category) continue;
    const ym = t.date.slice(0, 7);
    if (!monthly[ym]) monthly[ym] = {};
    monthly[ym][t.category] = (monthly[ym][t.category] || 0) + t.amount;
  }

  return { monthly, excludedIds, excludedCount: excludedIds.size };
}

/** Per-month total spend for a category (its own bucket + all subcategory buckets). */
function categoryMonthlyTotals(
  cat: ForecastCategory,
  cleanedMonthly: Record<string, Record<string, number>>,
): number[] {
  const names = [cat.name, ...cat.subcategories.map((s) => s.name)];
  return Object.keys(cleanedMonthly).map((m) => {
    const spend = cleanedMonthly[m];
    return names.reduce((sum, n) => sum + (spend[n] || 0), 0);
  });
}

/**
 * Median monthly (outlier-free) spend per category, keyed by category primaryId.
 * This is the "typical month" baseline used both for the fallback suggestion and
 * for soft-clamping the LLM's numbers.
 */
export function computeCategoryBaselines(
  categories: ForecastCategory[],
  cleanedMonthly: Record<string, Record<string, number>>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const cat of categories) {
    map[cat.primaryId] = median(categoryMonthlyTotals(cat, cleanedMonthly));
  }
  return map;
}

/**
 * Deterministic, non-LLM budget suggestion built purely from outlier-cleaned
 * history. Each category is set to its typical (median) monthly spend; the whole
 * plan is scaled down proportionally if it exceeds the wallet balance.
 */
export function buildStatisticalSuggestion(
  categories: ForecastCategory[],
  cleanedMonthly: Record<string, Record<string, number>>,
  walletBalance: number,
): {
  suggestions: AiCategorySuggestion[];
  total_suggested: number;
  summary: string;
} {
  const baselines = computeCategoryBaselines(categories, cleanedMonthly);
  const totalRaw = categories.reduce(
    (s, c) => s + (baselines[c.primaryId] || 0),
    0,
  );
  const scale =
    walletBalance > 0 && totalRaw > walletBalance
      ? walletBalance / totalRaw
      : 1;

  const suggestions: AiCategorySuggestion[] = categories.map((cat) => {
    const baseline = baselines[cat.primaryId] || 0;
    const budget = round2(baseline * scale);

    let subcategories: AiCategorySuggestion["subcategories"];
    if (cat.subcategories.length > 0) {
      const subSpend = cat.subcategories.map((sub) => {
        const total = Object.values(cleanedMonthly).reduce(
          (sum, spend) => sum + (spend[sub.name] || 0),
          0,
        );
        return { sub, total };
      });
      const subTotal = subSpend.reduce((s, x) => s + x.total, 0);
      subcategories = subSpend.map(({ sub, total }) => {
        const pct =
          subTotal > 0
            ? Math.round((total / subTotal) * 100)
            : Math.round(100 / cat.subcategories.length);
        return {
          subcategory_id: sub.primaryId,
          subcategory_name: sub.name,
          percentage: pct,
          suggested_amount: round2((pct / 100) * budget),
        };
      });
    }

    return {
      category_id: cat.primaryId,
      category_name: cat.name,
      suggested_budget: budget,
      reasoning:
        baseline > 0
          ? `Based on your typical monthly spend of ~$${baseline.toFixed(0)} (one-off charges excluded).`
          : `No recent spending here — a small buffer is set aside.`,
      subcategories,
    };
  });

  const total_suggested = round2(
    suggestions.reduce((s, c) => s + c.suggested_budget, 0),
  );

  return {
    suggestions,
    total_suggested,
    summary:
      "Estimated from your last few months of spending, with one-off spikes filtered out so each category reflects a typical month.",
  };
}

/**
 * Anchor LLM suggestions to reality: cap any category whose suggested budget
 * exceeds `factor`× its typical monthly spend. Categories with no history
 * (`baseline <= 0`) are left untouched so the AI can legitimately introduce a
 * brand-new envelope. Subcategory amounts are scaled down with their parent.
 */
export function softClampSuggestions(
  suggestions: AiCategorySuggestion[],
  baselines: Record<string, number>,
  factor = 2.5,
): AiCategorySuggestion[] {
  return suggestions.map((s) => {
    const baseline = baselines[s.category_id] || 0;
    if (baseline <= 0) return s;
    const cap = baseline * factor;
    if (s.suggested_budget <= cap) return s;
    const clamped = round2(cap);
    const ratio = s.suggested_budget > 0 ? clamped / s.suggested_budget : 1;
    return {
      ...s,
      suggested_budget: clamped,
      subcategories: s.subcategories?.map((sub) => ({
        ...sub,
        suggested_amount: round2(sub.suggested_amount * ratio),
      })),
    };
  });
}
