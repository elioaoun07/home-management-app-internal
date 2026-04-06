"use client";

import {
  generateForecast,
  type ForecastResult,
  type MonthlyDataPoint,
} from "@/lib/utils/forecast";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// --- Types ---

export type CategoryBreakdownItem = {
  name: string;
  amount: number;
  color: string;
  classification: "need" | "want" | "saving" | null;
};

export type DailyTotal = {
  date: string;
  income: number;
  expense: number;
};

export type MonthlyAnalytics = {
  month: string;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  transactionCount: number;
  categoryBreakdown: CategoryBreakdownItem[];
  dailyTotals: DailyTotal[];
  myExpense: number;
  partnerExpense: number;
};

export type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  monthlyEquivalent: number;
  recurrenceType: string;
};

export type AccountBalance = {
  id: string;
  name: string;
  type: string;
  userId: string;
  currentBalance: number;
};

export type AnalyticsResponse = {
  months: MonthlyAnalytics[];
  needsWantsSavings: {
    needs: number;
    wants: number;
    savings: number;
    unclassified: number;
  };
  recurring: {
    totalMonthly: number;
    items: RecurringItem[];
  };
  debts: {
    totalOwed: number;
    totalOwedToYou: number;
    openCount: number;
  };
  accounts: AccountBalance[];
  hasPartner: boolean;
  currentUserId: string;
};

// --- LocalStorage caching ---

const ANALYTICS_CACHE_KEY = "analytics-v2"; // bumped version to invalidate stale empty caches
const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour

function readCache(
  key: string,
): { data: AnalyticsResponse; ts: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${ANALYTICS_CACHE_KEY}-${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_MAX_AGE) return null;
    // Don't serve empty cache — force refetch
    if (!parsed.data?.months?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: AnalyticsResponse) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${ANALYTICS_CACHE_KEY}-${key}`,
      JSON.stringify({ data, ts: Date.now() }),
    );
  } catch {
    // quota exceeded — ignore
  }
}

// --- Hook ---

export function useAnalytics(params: {
  months?: number;
  accountId?: string;
  ownership?: "mine" | "partner" | "all";
}) {
  const { months = 6, accountId, ownership = "all" } = params;
  const cacheKey = `${months}-${accountId || "all"}-${ownership}`;

  return useQuery<AnalyticsResponse>({
    queryKey: ["analytics", { months, accountId, ownership }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("months", String(months));
      if (accountId) sp.set("accountId", accountId);
      sp.set("ownership", ownership);

      const res = await fetch(`/api/analytics?${sp.toString()}`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Analytics API ${res.status}: ${body}`);
      }
      const data: AnalyticsResponse = await res.json();
      writeCache(cacheKey, data);
      return data;
    },
    initialData: () => readCache(cacheKey)?.data,
    initialDataUpdatedAt: () => readCache(cacheKey)?.ts,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// --- Derived data hooks ---

/**
 * Compute expense forecast from analytics months
 */
export function useExpenseForecast(
  months: MonthlyAnalytics[] | undefined,
  forecastMonths: number = 3,
): ForecastResult[] {
  return useMemo(() => {
    if (!months || months.length < 2) return [];
    const data: MonthlyDataPoint[] = months.map((m) => ({
      month: m.month,
      value: m.expense,
    }));
    return generateForecast(data, forecastMonths);
  }, [months, forecastMonths]);
}

/**
 * Compute income forecast from analytics months
 */
export function useIncomeForecast(
  months: MonthlyAnalytics[] | undefined,
  forecastMonths: number = 3,
): ForecastResult[] {
  return useMemo(() => {
    if (!months || months.length < 2) return [];
    const data: MonthlyDataPoint[] = months.map((m) => ({
      month: m.month,
      value: m.income,
    }));
    return generateForecast(data, forecastMonths);
  }, [months, forecastMonths]);
}

/**
 * Financial health score: 0-100
 * Based on savings rate (40%), spending trend (25%), debt ratio (20%), consistency (15%)
 *
 * When `periodMonths` is provided, scores are computed against those months
 * instead of the full analytics window, making the widget period-aware.
 */
export function useHealthScore(
  analytics: AnalyticsResponse | undefined,
  periodMonths?: MonthlyAnalytics[],
): {
  score: number;
  factors: { label: string; score: number; weight: number; max: number }[];
} {
  return useMemo(() => {
    const months = periodMonths ?? analytics?.months;
    if (!analytics || !months || months.length === 0) {
      return { score: 0, factors: [] };
    }

    const latest = months[months.length - 1];

    // Factor 1: Savings Rate (40 points max)
    // 20%+ savings rate = full score
    const savingsRate = latest.savingsRate;
    const savingsScore = Math.min(40, Math.max(0, (savingsRate / 20) * 40));

    // Factor 2: Spending Trend (25 points max)
    // Declining or flat expense trend = good
    let trendScore = 12.5; // neutral default
    if (months.length >= 3) {
      const recent = months.slice(-3);
      const first = recent[0].expense;
      const last = recent[recent.length - 1].expense;
      if (first > 0) {
        const change = (last - first) / first;
        // -10% → 25pts, 0% → 15pts, +10% → 5pts
        trendScore = Math.min(25, Math.max(0, 15 - change * 100));
      }
    }

    // Factor 3: Debt Ratio (20 points max)
    // No debt = full score
    const totalIncome = latest.income || 1;
    const debtLoad = analytics.debts.totalOwed;
    const debtRatio = debtLoad / totalIncome;
    const debtScore = Math.min(20, Math.max(0, 20 - debtRatio * 20));

    // Factor 4: Consistency (15 points max)
    // Low variance in expenses across months = stable = good
    let consistencyScore = 7.5;
    if (months.length >= 3) {
      const expenses = months.map((m) => m.expense);
      const avg = expenses.reduce((s, e) => s + e, 0) / expenses.length;
      if (avg > 0) {
        const variance =
          expenses.reduce((s, e) => s + (e - avg) ** 2, 0) / expenses.length;
        const cv = Math.sqrt(variance) / avg; // coefficient of variation
        // cv 0 → 15pts, cv 0.5 → 7.5pts, cv 1+ → 0pts
        consistencyScore = Math.min(15, Math.max(0, 15 * (1 - cv)));
      }
    }

    const score = Math.round(
      savingsScore + trendScore + debtScore + consistencyScore,
    );

    return {
      score: Math.min(100, Math.max(0, score)),
      factors: [
        {
          label: "Savings Rate",
          score: Math.round(savingsScore),
          weight: 40,
          max: 40,
        },
        {
          label: "Spending Trend",
          score: Math.round(trendScore),
          weight: 25,
          max: 25,
        },
        {
          label: "Debt Health",
          score: Math.round(debtScore),
          weight: 20,
          max: 20,
        },
        {
          label: "Consistency",
          score: Math.round(consistencyScore),
          weight: 15,
          max: 15,
        },
      ],
    };
  }, [analytics, periodMonths]);
}
