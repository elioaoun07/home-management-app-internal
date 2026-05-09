"use client";

import { safeFetch } from "@/lib/safeFetch";
import { CACHE_TIMES, getCachedPreferences } from "@/lib/queryConfig";
import { getDefaultDateRange } from "@/lib/utils/date";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface BudgetSummary {
  total: number;
  topCategory: string | null;
  topCategoryAmount: number;
  txCount: number;
  dailyAvg: number;
  periodStart: string;
  periodEnd: string;
}

async function fetchBudgetSummary(): Promise<BudgetSummary> {
  const prefs = getCachedPreferences();
  const raw = prefs?.date_start ?? "";
  const monthStartDay = Number(raw.split("-")[1] ?? "1") || 1;
  const { start, end } = getDefaultDateRange(monthStartDay);

  const res = await safeFetch(`/api/transactions?start=${start}&end=${end}`, { timeoutMs: 10_000 });
  if (!res.ok) return { total: 0, topCategory: null, topCategoryAmount: 0, txCount: 0, dailyAvg: 0, periodStart: start, periodEnd: end };

  const transactions: Array<{ amount: number; category?: { name: string } | null }> = await res.json();

  const total = transactions.reduce((s, t) => s + (t.amount ?? 0), 0);
  const txCount = transactions.length;

  const catMap: Record<string, number> = {};
  for (const t of transactions) {
    const name = t.category?.name ?? "Uncategorized";
    catMap[name] = (catMap[name] ?? 0) + t.amount;
  }
  const sorted = Object.entries(catMap).sort(([, a], [, b]) => b - a);
  const topCategory = sorted[0]?.[0] ?? null;
  const topCategoryAmount = sorted[0]?.[1] ?? 0;

  const elapsedDays = Math.max(1, Math.floor((Date.now() - new Date(start).getTime()) / 86_400_000) + 1);
  const dailyAvg = total / elapsedDays;

  return { total, topCategory, topCategoryAmount, txCount, dailyAvg, periodStart: start, periodEnd: end };
}

export function useBudgetSummary() {
  return useQuery({
    queryKey: eraKeys.widgets.budget(),
    queryFn: fetchBudgetSummary,
    staleTime: CACHE_TIMES.TRANSACTIONS,
  });
}
