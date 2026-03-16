/**
 * Forecasting utilities for financial projections
 * Implements Simple Moving Average, Weighted Moving Average, and Linear Regression
 */

export type MonthlyDataPoint = {
  month: string; // YYYY-MM
  value: number;
};

export type ForecastResult = {
  month: string;
  predicted: number;
  lower: number; // confidence band lower
  upper: number; // confidence band upper
};

/**
 * Simple Moving Average — average of last N periods
 */
export function simpleMovingAverage(
  data: MonthlyDataPoint[],
  window: number = 3,
): number {
  if (data.length === 0) return 0;
  const slice = data.slice(-window);
  return slice.reduce((sum, d) => sum + d.value, 0) / slice.length;
}

/**
 * Weighted Moving Average — recent months weighted higher
 * Weights: [1, 2, 3, ...N] where N is most recent
 */
export function weightedMovingAverage(
  data: MonthlyDataPoint[],
  window: number = 3,
): number {
  if (data.length === 0) return 0;
  const slice = data.slice(-window);
  const weights = slice.map((_, i) => i + 1);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const weightedSum = slice.reduce(
    (sum, d, i) => sum + d.value * weights[i],
    0,
  );
  return weightedSum / totalWeight;
}

/**
 * Linear Regression (least squares) — returns slope and intercept
 * x values are 0-indexed sequence numbers (0, 1, 2, ...)
 */
export function linearRegression(data: MonthlyDataPoint[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.value ?? 0, r2: 0 };

  const xs = data.map((_, i) => i);
  const ys = data.map((d) => d.value);

  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssTotal = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssResidual = ys.reduce(
    (s, y, i) => s + (y - (intercept + slope * xs[i])) ** 2,
    0,
  );
  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return { slope, intercept, r2 };
}

/**
 * Calculate standard deviation of residuals (for confidence bands)
 */
function residualStdDev(
  data: MonthlyDataPoint[],
  slope: number,
  intercept: number,
): number {
  const n = data.length;
  if (n < 3) return 0;
  const residuals = data.map((d, i) => d.value - (intercept + slope * i));
  const mean = residuals.reduce((s, r) => s + r, 0) / n;
  const variance = residuals.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 2);
  return Math.sqrt(variance);
}

/**
 * Generate next month string from YYYY-MM
 */
function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Generate forecast for N future months using combined methods
 * Returns predicted values with confidence bands
 */
export function generateForecast(
  data: MonthlyDataPoint[],
  months: number = 3,
): ForecastResult[] {
  if (data.length < 2) return [];

  const { slope, intercept, r2 } = linearRegression(data);
  const stdDev = residualStdDev(data, slope, intercept);
  const wma = weightedMovingAverage(data, Math.min(data.length, 4));
  const n = data.length;

  const results: ForecastResult[] = [];
  let lastMonth = data[data.length - 1].month;

  for (let i = 0; i < months; i++) {
    lastMonth = nextMonth(lastMonth);
    const x = n + i;

    // Blend linear regression with WMA based on R² quality
    // High R² → trust regression more; Low R² → lean on WMA
    const regPrediction = intercept + slope * x;
    const blendWeight = Math.max(0.3, Math.min(0.8, r2));
    const predicted = regPrediction * blendWeight + wma * (1 - blendWeight);

    // Confidence band widens for further-out predictions
    const widthMultiplier = 1.5 + i * 0.5;
    const band = stdDev * widthMultiplier;

    results.push({
      month: lastMonth,
      predicted: Math.max(0, predicted),
      lower: Math.max(0, predicted - band),
      upper: predicted + band,
    });
  }

  return results;
}

/**
 * Detect trend direction and strength
 */
export function detectTrend(data: MonthlyDataPoint[]): {
  direction: "up" | "down" | "flat";
  strength: number; // 0-1
  monthlyChange: number; // average monthly change
} {
  if (data.length < 2)
    return { direction: "flat", strength: 0, monthlyChange: 0 };

  const { slope, r2 } = linearRegression(data);
  const avgValue = data.reduce((s, d) => s + d.value, 0) / data.length;
  const monthlyChange = avgValue > 0 ? slope / avgValue : 0;

  return {
    direction:
      Math.abs(monthlyChange) < 0.02 ? "flat" : slope > 0 ? "up" : "down",
    strength: Math.abs(r2),
    monthlyChange: slope,
  };
}
