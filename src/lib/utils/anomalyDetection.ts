/**
 * Statistical anomaly detection for budget analytics.
 * Identifies category-level and transaction-level outliers using
 * z-score analysis against historical data.
 */

export type AnomalySeverity = "info" | "warning" | "critical";

export type CategoryAnomaly = {
  category: string;
  currentAmount: number;
  historicalMean: number;
  historicalStdDev: number;
  zScore: number;
  percentAboveMean: number;
  severity: AnomalySeverity;
  type: "spike" | "drop";
  message: string;
};

export type TransactionAnomaly = {
  transactionId: string;
  description: string | null;
  amount: number;
  category: string;
  date: string;
  categoryMean: number;
  zScore: number;
  message: string;
};

export type AnomalyReport = {
  categoryAnomalies: CategoryAnomaly[];
  transactionAnomalies: TransactionAnomaly[];
  inactiveCategories: {
    category: string;
    historicalAvg: number;
    currentAmount: number;
    message: string;
  }[];
};

type MonthCategoryData = {
  month: string;
  categoryBreakdown: { name: string; amount: number }[];
};

type Transaction = {
  id: string;
  amount: number;
  category?: string | null;
  description?: string | null;
  date: string;
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function getSeverity(zScore: number): AnomalySeverity {
  const abs = Math.abs(zScore);
  if (abs >= 2) return "critical";
  if (abs >= 1.5) return "warning";
  return "info";
}

/**
 * Detect anomalies in category spending by comparing the current period
 * against historical monthly data.
 *
 * @param months Array of monthly analytics data (oldest → newest).
 *               The LAST entry is treated as the "current" period.
 * @param minHistoryMonths Minimum months of history required (default: 3)
 * @param zThreshold Minimum |z-score| to flag (default: 1.5)
 */
export function detectCategoryAnomalies(
  months: MonthCategoryData[],
  minHistoryMonths = 3,
  zThreshold = 1.5,
): Pick<AnomalyReport, "categoryAnomalies" | "inactiveCategories"> {
  if (months.length < minHistoryMonths + 1) {
    return { categoryAnomalies: [], inactiveCategories: [] };
  }

  const history = months.slice(0, -1); // all but last
  const current = months[months.length - 1];

  // Build per-category historical distribution
  const categoryHistory: Record<string, number[]> = {};
  for (const m of history) {
    const seen = new Set<string>();
    for (const cb of m.categoryBreakdown) {
      if (!categoryHistory[cb.name]) categoryHistory[cb.name] = [];
      categoryHistory[cb.name].push(cb.amount);
      seen.add(cb.name);
    }
    // Record 0 for categories that existed before but not this month
    for (const cat of Object.keys(categoryHistory)) {
      if (!seen.has(cat)) {
        categoryHistory[cat].push(0);
      }
    }
  }

  // Current period amounts
  const currentAmounts: Record<string, number> = {};
  for (const cb of current.categoryBreakdown) {
    currentAmounts[cb.name] = cb.amount;
  }

  const anomalies: CategoryAnomaly[] = [];
  const inactive: AnomalyReport["inactiveCategories"] = [];

  for (const [cat, values] of Object.entries(categoryHistory)) {
    if (values.length < minHistoryMonths) continue;

    const avg = mean(values);
    const sd = stdDev(values, avg);
    const currentAmt = currentAmounts[cat] ?? 0;

    // Skip categories with negligible history
    if (avg < 1 && currentAmt < 1) continue;

    // Handle zero std dev (perfectly consistent spending)
    if (sd < 0.01) {
      if (Math.abs(currentAmt - avg) > avg * 0.2 && avg > 5) {
        const type = currentAmt > avg ? "spike" : "drop";
        const pct = avg > 0 ? ((currentAmt - avg) / avg) * 100 : 100;
        anomalies.push({
          category: cat,
          currentAmount: currentAmt,
          historicalMean: avg,
          historicalStdDev: sd,
          zScore: currentAmt > avg ? 3 : -3,
          percentAboveMean: pct,
          severity: "warning",
          type,
          message:
            type === "spike"
              ? `${cat}: $${currentAmt.toFixed(0)} this period vs $${avg.toFixed(0)} usual (${Math.abs(pct).toFixed(0)}% above normal)`
              : `${cat}: $${currentAmt.toFixed(0)} this period vs $${avg.toFixed(0)} usual (${Math.abs(pct).toFixed(0)}% below normal)`,
        });
      }
      continue;
    }

    const zScore = (currentAmt - avg) / sd;

    if (Math.abs(zScore) >= zThreshold) {
      const type = zScore > 0 ? "spike" : "drop";
      const pct = avg > 0 ? ((currentAmt - avg) / avg) * 100 : 100;
      anomalies.push({
        category: cat,
        currentAmount: currentAmt,
        historicalMean: avg,
        historicalStdDev: sd,
        zScore,
        percentAboveMean: pct,
        severity: getSeverity(zScore),
        type,
        message:
          type === "spike"
            ? `${cat}: $${currentAmt.toFixed(0)} this period vs $${avg.toFixed(0)} avg (${Math.abs(pct).toFixed(0)}% above normal)`
            : `${cat}: $${currentAmt.toFixed(0)} this period vs $${avg.toFixed(0)} avg (${Math.abs(pct).toFixed(0)}% below normal)`,
      });
    }

    // Check for unusual inactivity — category had consistent spending but now near zero
    if (avg > 20 && currentAmt < avg * 0.15) {
      inactive.push({
        category: cat,
        historicalAvg: avg,
        currentAmount: currentAmt,
        message: `${cat}: Usually $${avg.toFixed(0)}/mo — only $${currentAmt.toFixed(0)} so far`,
      });
    }
  }

  // Check for brand new high-spending categories (no history)
  for (const [cat, amt] of Object.entries(currentAmounts)) {
    if (!categoryHistory[cat] && amt > 50) {
      anomalies.push({
        category: cat,
        currentAmount: amt,
        historicalMean: 0,
        historicalStdDev: 0,
        zScore: 3,
        percentAboveMean: 100,
        severity: "warning",
        type: "spike",
        message: `${cat}: $${amt.toFixed(0)} — new category with no prior spending history`,
      });
    }
  }

  // Sort by severity then z-score
  anomalies.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const sDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sDiff !== 0) return sDiff;
    return Math.abs(b.zScore) - Math.abs(a.zScore);
  });

  return { categoryAnomalies: anomalies, inactiveCategories: inactive };
}

/**
 * Detect outlier individual transactions within each category.
 * Flags transactions whose amount is >2σ above the category mean.
 */
export function detectTransactionAnomalies(
  transactions: Transaction[],
  zThreshold = 2,
): TransactionAnomaly[] {
  // Group by category
  const byCategory: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    const cat = t.category ?? "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  }

  const anomalies: TransactionAnomaly[] = [];

  for (const [cat, txs] of Object.entries(byCategory)) {
    if (txs.length < 4) continue; // need enough data

    const amounts = txs.map((t) => t.amount);
    const avg = mean(amounts);
    const sd = stdDev(amounts, avg);
    if (sd < 0.01) continue;

    for (const t of txs) {
      const z = (t.amount - avg) / sd;
      if (z >= zThreshold) {
        anomalies.push({
          transactionId: t.id,
          description: t.description ?? null,
          amount: t.amount,
          category: cat,
          date: t.date,
          categoryMean: avg,
          zScore: z,
          message: `$${t.amount.toFixed(0)} in ${cat} — ${z.toFixed(1)}× above avg ($${avg.toFixed(0)})`,
        });
      }
    }
  }

  anomalies.sort((a, b) => b.zScore - a.zScore);
  return anomalies.slice(0, 10); // top 10
}
