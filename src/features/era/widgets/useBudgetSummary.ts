"use client";

import { CACHE_TIMES, getCachedPreferences } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { getDefaultDateRange } from "@/lib/utils/date";
import { useQuery } from "@tanstack/react-query";
import { eraKeys } from "../queryKeys";

export interface BudgetCategorySlice {
  name: string;
  amount: number;
}

export interface BudgetSummary {
  total: number;
  previousPeriodTotal: number;
  /** Percentage delta vs previous period; null if previous was 0. */
  deltaPct: number | null;
  topCategory: string | null;
  topCategoryAmount: number;
  /** Top 3 categories by spend in the current period. */
  top3Categories: BudgetCategorySlice[];
  txCount: number;
  dailyAvg: number;
  /** Last 7 calendar-day spend totals, oldest → newest. */
  last7Days: number[];
  periodStart: string;
  periodEnd: string;
}

interface TxRow {
  amount: number;
  date: string;
  /** API returns category as a flat string (the name) — see SupabaseTransactionService. */
  category?: string | null;
  account_name?: string | null;
}

function previousPeriodRange(
  start: string,
  end: string,
): { start: string; end: string } {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.max(
    1,
    Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1,
  );
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  };
}

async function fetchTransactions(start: string, end: string): Promise<TxRow[]> {
  const res = await safeFetch(`/api/transactions?start=${start}&end=${end}`, {
    timeoutMs: 10_000,
  });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function fetchBudgetSummary(): Promise<BudgetSummary> {
  const prefs = getCachedPreferences();
  const raw = prefs?.date_start ?? "";
  const monthStartDay = Number(raw.split("-")[1] ?? "1") || 1;
  const { start, end } = getDefaultDateRange(monthStartDay);
  const prev = previousPeriodRange(start, end);

  const [current, previous] = await Promise.all([
    fetchTransactions(start, end),
    fetchTransactions(prev.start, prev.end),
  ]);

  const total = current.reduce((s, t) => s + (t.amount ?? 0), 0);
  const previousPeriodTotal = previous.reduce((s, t) => s + (t.amount ?? 0), 0);
  const txCount = current.length;

  const catMap: Record<string, number> = {};
  for (const t of current) {
    const name = t.category ?? "No category";
    catMap[name] = (catMap[name] ?? 0) + t.amount;
  }
  const sorted = Object.entries(catMap).sort(([, a], [, b]) => b - a);
  const top3Categories: BudgetCategorySlice[] = sorted
    .slice(0, 3)
    .map(([name, amount]) => ({ name, amount }));

  const elapsedDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(start).getTime()) / 86_400_000) + 1,
  );
  const dailyAvg = total / elapsedDays;

  // Last 7 calendar days (rolling), oldest → newest. Drawn from `current` but
  // we also pull the tail of `previous` if start of window is before period start.
  const all = [...previous, ...current];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last7Days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    let sum = 0;
    for (const t of all) {
      if (t.date?.slice(0, 10) === key) sum += t.amount ?? 0;
    }
    last7Days.push(+sum.toFixed(2));
  }

  const deltaPct =
    previousPeriodTotal > 0
      ? ((total - previousPeriodTotal) / previousPeriodTotal) * 100
      : null;

  return {
    total,
    previousPeriodTotal,
    deltaPct,
    topCategory: top3Categories[0]?.name ?? null,
    topCategoryAmount: top3Categories[0]?.amount ?? 0,
    top3Categories,
    txCount,
    dailyAvg,
    last7Days,
    periodStart: start,
    periodEnd: end,
  };
}

export function useBudgetSummary() {
  return useQuery({
    queryKey: eraKeys.widgets.budget(),
    queryFn: fetchBudgetSummary,
    staleTime: CACHE_TIMES.TRANSACTIONS,
  });
}
