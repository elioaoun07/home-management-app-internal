"use client";

import type { AccountBalance } from "@/features/analytics/useAnalytics";
import { useMemo } from "react";

export type NetWorthDataPoint = {
  month: string;
  total: number;
  byAccount: { name: string; balance: number; type: string }[];
};

/**
 * Derive net worth from analytics months + current account balances.
 * This works backward from current balances using monthly income/expense deltas.
 */
export function useNetWorthSeries(
  months:
    | { month: string; income: number; expense: number; savings: number }[]
    | undefined,
  accounts: AccountBalance[] | undefined,
): NetWorthDataPoint[] {
  return useMemo(() => {
    if (!months || months.length === 0 || !accounts || accounts.length === 0) {
      return [];
    }

    // Current total balance
    const currentTotal = accounts.reduce(
      (s, a) => s + Number(a.currentBalance),
      0,
    );

    // Work backwards from current balance using monthly net changes
    // net change per month = income - expense + savings deposits
    const monthlyNetChanges = months.map((m) => m.income - m.expense);

    // Build series going backwards then reverse
    const points: NetWorthDataPoint[] = [];
    let runningTotal = currentTotal;

    // Last month = current
    for (let i = months.length - 1; i >= 0; i--) {
      points.unshift({
        month: months[i].month,
        total: Math.round(runningTotal * 100) / 100,
        byAccount: accounts.map((a) => ({
          name: a.name,
          balance: Number(a.currentBalance),
          type: a.type,
        })),
      });
      // Step back by subtracting this month's net change
      if (i > 0) {
        runningTotal -= monthlyNetChanges[i];
      }
    }

    return points;
  }, [months, accounts]);
}
