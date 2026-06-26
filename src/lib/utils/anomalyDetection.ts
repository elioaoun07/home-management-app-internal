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

export type AnomalyReport = {
  categoryAnomalies: CategoryAnomaly[];
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

const EPS = 1e-9;

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2 : sortedAsc[mid];
}

function madFromSorted(values: number[], med: number): number {
  const deviations = values.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  return median(deviations);
}

function meanAbsDev(values: number[], center: number): number {
  if (values.length === 0) return 0;
  return mean(values.map((v) => Math.abs(v - center)));
}

function percentileSorted(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  if (n === 1) return sortedAsc[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}

/** Robust spread estimate: 1.4826×MAD, falling back to mean-abs-deviation when MAD is ~0. */
function robustScale(values: number[], med: number): number {
  const mad = madFromSorted(values, med);
  const scaled = 1.4826 * mad;
  if (scaled > EPS) return scaled;
  return meanAbsDev(values, med);
}

/**
 * Robust location/scale in LOG space. Spending tiers are multiplicative — a
 * snack is ~$10, a delivery ~$40, a grocery run ~$150 (×4, ×15) — so a linear
 * median/MAD over a multi-tier category is dominated by the densest low tier
 * and makes every higher tier look like a spike. Scoring `log(amount)` instead
 * tolerates a wide, naturally-tiered spread while still catching a value that
 * is large *even on a log scale*. `median` is kept in linear dollars for the
 * human-readable message; `logMedian`/`logScale` drive the z-score.
 */
function logStats(amountsAsc: number[]): {
  median: number;
  logMedian: number;
  logScale: number;
} {
  const med = median(amountsAsc);
  const logs = amountsAsc.map((a) => Math.log(Math.max(a, EPS))).sort((a, b) => a - b);
  const logMed = median(logs);
  return { median: med, logMedian: logMed, logScale: robustScale(logs, logMed) };
}

/**
 * Split a sorted-ascending series in two at its single largest proportional
 * gap, e.g. separating everyday snack-sized purchases from periodic big
 * shopping trips. Returns null when no gap clears `minGapRatio` — i.e. the
 * series looks like one continuous distribution, not two.
 *
 * Gaps anchored below `minAnchor` are ignored: a near-zero value (a $0.01
 * rounding/refund transaction) produces an enormous ratio purely from being
 * close to zero, which would otherwise hijack the split point and merge the
 * real high mode in with everything below it instead of isolating it.
 */
function splitByLargestGap(
  sortedAsc: number[],
  minGapRatio: number,
  minAnchor: number,
): { low: number[]; high: number[] } | null {
  let bestIdx = -1;
  let bestRatio = 1;
  for (let i = 0; i < sortedAsc.length - 1; i++) {
    const a = sortedAsc[i];
    const b = sortedAsc[i + 1];
    if (a < minAnchor) continue;
    const ratio = b / a;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestIdx = i;
    }
  }
  if (bestIdx === -1 || bestRatio < minGapRatio) return null;
  return { low: sortedAsc.slice(0, bestIdx + 1), high: sortedAsc.slice(bestIdx + 1) };
}

function getSeverity(zScore: number): AnomalySeverity {
  const abs = Math.abs(zScore);
  if (abs >= 2) return "critical";
  if (abs >= 1.5) return "warning";
  return "info";
}

/**
 * Collapse a raw transaction description into a stable merchant key so that
 * the same real-world merchant groups together regardless of bank-statement
 * noise. Card statements append a per-transaction store/reference code (e.g.
 * "…BEIRUT LB 0000" vs "…BEIRUT LB 3043") and channel prefixes ("Online
 * Purchase", "POS Purchase", "Bill Payment"), which would otherwise split one
 * recurring merchant into many singletons and defeat the recurrence exemption.
 * Returns "" for empty/unusable descriptions (callers skip those).
 */
export function normalizeMerchant(desc: string | null | undefined): string {
  if (!desc) return "";
  let s = desc.toLowerCase();
  // Drop embedded invoice/reference tokens ("invoice # 1261", "invoice magic11").
  s = s.replace(/invoice\s*#?\s*\w+/g, " ");
  // Drop channel/noise words wherever they appear.
  s = s.replace(/\b(online purchase|pos purchase|bill payment|reverse)\b/g, " ");
  // Drop a trailing store/reference code (3+ digits at the end).
  s = s.replace(/\s*#?\d{3,}\s*$/g, " ");
  // Trim stray leading/trailing punctuation, collapse internal whitespace.
  s = s.replace(/^[^a-z0-9]+/, "").replace(/[^a-z0-9]+$/, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const DAY_MS = 86_400_000;

/** Known recurrence periods in days, matched within ±tolerance. */
const CADENCE_PERIODS = [7, 14, 30, 90, 365];
const CADENCE_TOLERANCE = 0.25;

/**
 * Decide whether a series of transaction dates (same category + merchant)
 * follows a steady real-world rhythm — monthly tithing, ~3-weekly car fuel,
 * a yearly subscription — so it can be treated as recurring and never flagged
 * as an outlier, regardless of how much the amount varies.
 *
 * Uses the MEDIAN inter-transaction gap (robust to a single skipped/double
 * month) and requires the spread of gaps to be small relative to that median.
 */
function isRecurringCadence(datesAsc: string[], minPeriodDays = 0): boolean {
  if (datesAsc.length < 3) return false;
  const times = datesAsc.map((d) => new Date(`${d}T00:00:00Z`).getTime());
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const g = (times[i] - times[i - 1]) / DAY_MS;
    if (g > 0) gaps.push(g);
  }
  if (gaps.length < 2) return false;
  const sortedGaps = gaps.slice().sort((a, b) => a - b);
  const medGap = median(sortedGaps);
  if (medGap <= 0) return false;
  const period = CADENCE_PERIODS.find(
    (p) => p >= minPeriodDays && Math.abs(medGap - p) <= p * CADENCE_TOLERANCE,
  );
  if (!period) return false;
  // Gaps must cluster tightly around the median to count as a rhythm.
  const spread = meanAbsDev(gaps, medGap);
  return spread <= medGap * CADENCE_TOLERANCE * 2;
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

export type OutlierReason = "spike" | "rare";

export type TransactionOutlier = {
  transactionId: string;
  amount: number;
  category: string;
  date: string;
  reason: OutlierReason;
  score: number;
  message: string;
};

/** A user-confirmed recurring payment used to suppress its real transactions
 * from outlier flagging (authoritative — beats any statistical guess). */
export type RecurringHint = {
  /** Category name the recurring payment is filed under, if any. */
  category?: string | null;
  /** Display name / merchant of the recurring payment (e.g. "Netflix"). */
  name: string;
  /** Expected amount; matches are accepted within ±40% to absorb drift. */
  amount: number;
};

export type OutlierOptions = {
  /** Registered recurring payments to exempt from flagging (default none). */
  recurringHints?: RecurringHint[];
  /** Categories active in at least this many distinct months are treated as "established" (default 3). */
  populatedMonthsActive?: number;
  /** Established categories also need at least this many transactions for a stable baseline (default 4). */
  minCategoryCount?: number;
  /** Robust z-score threshold for in-category spikes — "how many robust-sigmas above the category median" (default 3.5, per Iglewicz & Hoaglin's recommended cutoff). */
  modifiedZThreshold?: number;
  /** Minimum proportional jump (default 2.5×) between consecutive sorted amounts to treat a category as having two legitimate modes (e.g. everyday snacks vs. periodic big shopping trips) instead of one. */
  bimodalGapRatio?: number;
  /** Amounts below this (default 1) can't anchor a bimodal split — a near-zero transaction (e.g. a $0.01 refund/rounding artifact) would otherwise produce a spuriously huge ratio and hijack the split point. */
  bimodalMinAnchor?: number;
  /** Percentile of all amounts used as a "notable size" floor for rare-category transactions (default 0.90). */
  globalPercentile?: number;
  /** Robust-sigma multiplier added to the global median for the rare-category floor (default 3.5). */
  globalMadK?: number;
  /** Minimum distinct months in the whole window before rarity is considered meaningful (default 2). */
  minWindowMonths?: number;
  /** Safety cap on returned results (default 50). */
  maxResults?: number;
};

/**
 * Detect outlier transactions using two signals against the rest of the window:
 *  - "spike": unusual for ITS OWN category, once that category has enough history
 *    (median/MAD based, so the outlier itself can't inflate its own baseline).
 *    Categories with a recurring large-amount sub-pattern (e.g. everyday snacks
 *    plus a periodic full grocery run) are split into two modes first, so the
 *    recurring "big" mode isn't mistaken for a spike against the "small" one.
 *  - "rare": a rarely-used or brand-new category whose amount is large relative to
 *    the household's OVERALL spending (e.g. a once-a-year gift or a one-off trip),
 *    which a per-category-only model can never see.
 */
export function detectTransactionOutliers(
  transactions: Transaction[],
  opts: OutlierOptions = {},
): TransactionOutlier[] {
  const {
    recurringHints = [],
    populatedMonthsActive = 3,
    minCategoryCount = 4,
    modifiedZThreshold = 3.5,
    bimodalGapRatio = 2.5,
    bimodalMinAnchor = 1,
    globalPercentile = 0.9,
    globalMadK = 3.5,
    minWindowMonths = 2,
    maxResults = 50,
  } = opts;

  if (transactions.length === 0) return [];

  type Norm = {
    id: string;
    amount: number;
    category: string;
    date: string;
    ym: string;
    descKey: string;
  };
  const normalized: Norm[] = [];
  for (const t of transactions) {
    const amount = Math.abs(t.amount);
    if (amount <= 0) continue;
    normalized.push({
      id: t.id,
      amount,
      category: t.category?.trim() || "Uncategorized",
      date: t.date,
      ym: t.date.slice(0, 7),
      descKey: normalizeMerchant(t.description),
    });
  }
  if (normalized.length === 0) return [];

  const distinctMonths = new Set(normalized.map((t) => t.ym));
  if (distinctMonths.size < minWindowMonths) return [];

  // Per-category grouping + classification. Done up front (amount-thresholds
  // aside) so the global baseline below can exclude fixed recurring bills.
  const byCategory = new Map<string, Norm[]>();
  for (const t of normalized) {
    const list = byCategory.get(t.category);
    if (list) list.push(t);
    else byCategory.set(t.category, [t]);
  }

  type Cluster = { median: number; logMedian: number; logScale: number };
  type CategoryInfo = {
    txs: Norm[];
    isEstablished: boolean;
    medianC: number;
    scaleC: number;
    logMedianC: number;
    logScaleC: number;
    /** Set only when the category has a recurring large-amount sub-pattern
     * (e.g. periodic big shopping trips) with enough history of its own to
     * be trusted as normal — not a one-off. Amounts > boundary score against
     * `high`; amounts <= boundary score against `low`, instead of both being
     * judged against one mixed log-median/scale that the minority mode would skew. */
    modes: { boundary: number; low: Cluster; high: Cluster } | null;
  };
  // Transactions that should never be flagged because they belong to a
  // recognized real-world pattern: a registered recurring payment, a steady
  // calendar rhythm (monthly tithing, etc.), or a merchant that recurs often
  // enough within a category (e.g. the same grocery store every couple weeks).
  // Catches cases the amount-based mode split can miss, e.g. a category with
  // more than two price tiers blending together with no single clean gap.
  const protectedIds = new Set<string>();

  // ── Recurring suppression #1 — registered recurring_payments (authoritative)
  if (recurringHints.length > 0) {
    const hints = recurringHints.map((h) => ({
      cat: (h.category ?? "").trim().toLowerCase(),
      key: normalizeMerchant(h.name),
      amount: Math.abs(h.amount),
    }));
    for (const t of normalized) {
      const catLower = t.category.toLowerCase();
      for (const h of hints) {
        const amtOk =
          h.amount <= 0 ||
          (t.amount >= h.amount * 0.6 && t.amount <= h.amount * 1.4);
        if (!amtOk) continue;
        const catOk = !!h.cat && catLower === h.cat;
        const merchOk =
          !!h.key &&
          !!t.descKey &&
          (t.descKey.includes(h.key) || h.key.includes(t.descKey));
        if (catOk || merchOk) {
          protectedIds.add(t.id);
          break;
        }
      }
    }
  }

  const categoryInfo = new Map<string, CategoryInfo>();
  for (const [cat, txs] of byCategory) {
    const monthsActive = new Set(txs.map((t) => t.ym)).size;
    const isEstablished =
      monthsActive >= populatedMonthsActive && txs.length >= minCategoryCount;

    // ── Recurring suppression #2 — steady calendar rhythm detected from dates.
    // Only for SPARSE categories (an established category already gets proper
    // amount-aware spike handling below, which must still catch a genuine jump
    // even if the category happens to be monthly-paced). Fires for monthly-or-
    // longer periods (≥28d) so organic weekly spending isn't wholesale exempt,
    // but a periodic sparse category (monthly tithing, quarterly dues) — which
    // would otherwise be mislabeled "rare" purely on size — is promoted to
    // recurring and never flagged.
    if (!isEstablished && isRecurringCadence(txs.map((t) => t.date).sort(), 28)) {
      for (const t of txs) protectedIds.add(t.id);
    }

    const amounts = txs.map((t) => t.amount).sort((a, b) => a - b);
    const medianC = median(amounts);
    const scaleC = robustScale(amounts, medianC);
    const { logMedian: logMedianC, logScale: logScaleC } = logStats(amounts);

    if (isEstablished) {
      const byDescription = new Map<string, Norm[]>();
      for (const t of txs) {
        if (!t.descKey) continue;
        const list = byDescription.get(t.descKey);
        if (list) list.push(t);
        else byDescription.set(t.descKey, [t]);
      }
      for (const descTxs of byDescription.values()) {
        const descMonths = new Set(descTxs.map((t) => t.ym)).size;
        // A normalized merchant that recurs ≥3× across ≥2 distinct months is a
        // trusted pattern. Lower than the category-establishment gate so a
        // merely-monthly merchant (e.g. one grocery run per month) qualifies.
        if (descTxs.length >= 3 && descMonths >= 2) {
          for (const t of descTxs) protectedIds.add(t.id);
        }
      }
    }

    let modes: CategoryInfo["modes"] = null;
    if (isEstablished) {
      const split = splitByLargestGap(amounts, bimodalGapRatio, bimodalMinAnchor);
      if (split) {
        const boundary = split.low[split.low.length - 1];
        const highTxs = txs.filter((t) => t.amount > boundary);
        const highMonths = new Set(highTxs.map((t) => t.ym)).size;
        // The "high" mode only counts as a legitimate second pattern once it
        // has repeated enough to be trusted — otherwise it's just a one-off
        // spike (scenario already handled below) and shouldn't get a pass.
        if (highTxs.length >= minCategoryCount && highMonths >= populatedMonthsActive) {
          modes = {
            boundary,
            low: logStats(split.low),
            high: logStats(split.high),
          };
        }
      }
    }

    categoryInfo.set(cat, {
      txs,
      isEstablished,
      medianC,
      scaleC,
      logMedianC,
      logScaleC,
      modes,
    });
  }

  // Global baseline for "rare-category" judgments — excludes established
  // categories with ~zero spread (fixed bills like rent/subscriptions).
  // Without this, a large recurring bill repeated every month dominates the
  // top percentile and masks genuinely rare-but-large transactions elsewhere.
  const globalPool: number[] = [];
  for (const info of categoryInfo.values()) {
    if (info.isEstablished && info.scaleC < EPS) continue;
    for (const t of info.txs) globalPool.push(t.amount);
  }
  const poolSorted = (globalPool.length > 0 ? globalPool : normalized.map((t) => t.amount))
    .slice()
    .sort((a, b) => a - b);
  const medianG = median(poolSorted);
  const scaleG = robustScale(poolSorted, medianG);
  const p90 = percentileSorted(poolSorted, globalPercentile);
  const notableFloor = Math.max(p90, medianG + globalMadK * scaleG);

  const outliers: TransactionOutlier[] = [];

  for (const [cat, info] of categoryInfo) {
    if (info.isEstablished) {
      // Branch 1 — spike within an established category
      if (info.modes) {
        // Two legitimate modes (e.g. snacks vs. periodic big shopping trips) —
        // score each transaction against its own mode (in log space), not the
        // mixed whole.
        const { boundary, low, high } = info.modes;
        for (const t of info.txs) {
          if (protectedIds.has(t.id)) continue;
          const cluster = t.amount > boundary ? high : low;
          if (cluster.logScale < EPS) continue;
          if (t.amount <= cluster.median) continue;
          const z =
            (Math.log(Math.max(t.amount, EPS)) - cluster.logMedian) /
            cluster.logScale;
          if (z > modifiedZThreshold) {
            outliers.push({
              transactionId: t.id,
              amount: t.amount,
              category: cat,
              date: t.date,
              reason: "spike",
              score: z,
              message: `$${t.amount.toFixed(0)} in ${cat} — ${z.toFixed(1)}σ above usual ($${cluster.median.toFixed(0)})`,
            });
          }
        }
        continue;
      }

      if (info.logScaleC < EPS) continue; // constant series (rent, subscriptions) — never flagged

      for (const t of info.txs) {
        if (protectedIds.has(t.id)) continue;
        if (t.amount <= info.medianC) continue;
        const z =
          (Math.log(Math.max(t.amount, EPS)) - info.logMedianC) / info.logScaleC;
        if (z > modifiedZThreshold) {
          outliers.push({
            transactionId: t.id,
            amount: t.amount,
            category: cat,
            date: t.date,
            reason: "spike",
            score: z,
            message: `$${t.amount.toFixed(0)} in ${cat} — ${z.toFixed(1)}σ above usual ($${info.medianC.toFixed(0)})`,
          });
        }
      }
    } else {
      // Branch 2 — rare/novel category, judged against overall spending
      for (const t of info.txs) {
        if (protectedIds.has(t.id)) continue; // recurring/rhythmic — not "rare"
        if (t.amount < notableFloor) continue;
        const score = scaleG < EPS ? Infinity : (t.amount - medianG) / scaleG;
        outliers.push({
          transactionId: t.id,
          amount: t.amount,
          category: cat,
          date: t.date,
          reason: "rare",
          score,
          message: `$${t.amount.toFixed(0)} in ${cat} — unusually large vs your typical spend`,
        });
      }
    }
  }

  outliers.sort((a, b) => b.score - a.score);
  return outliers.slice(0, maxResults);
}
