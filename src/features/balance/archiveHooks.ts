// src/features/balance/archiveHooks.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Types for balance archives
export interface BalanceArchive {
  id: string;
  account_id: string;
  year_month: string;
  month_start_date: string;
  month_end_date: string;
  opening_balance: number;
  closing_balance: number;
  total_transaction_count: number;
  total_income: number;
  total_expenses: number;
  net_change: number;
  total_transfers_in: number;
  total_transfers_out: number;
  transfer_count: number;
  total_adjustments: number;
  adjustment_count: number;
  archived_at: string;
}

export interface DailySummary {
  id: string;
  account_id: string;
  summary_date: string;
  opening_balance: number;
  closing_balance: number;
  transaction_count: number;
  income_count: number;
  expense_count: number;
  total_income: number;
  total_expenses: number;
  net_transactions: number;
  largest_income: number | null;
  largest_income_desc: string | null;
  largest_expense: number | null;
  largest_expense_desc: string | null;
  category_breakdown: CategoryBreakdown[] | null;
}

export interface CategoryBreakdown {
  name: string;
  color: string;
  amount: number;
  count: number;
}

// Query keys
export const balanceArchiveKeys = {
  all: ["balance-archives"] as const,
  account: (accountId: string) =>
    [...balanceArchiveKeys.all, accountId] as const,
  accountYear: (accountId: string, year: number) =>
    [...balanceArchiveKeys.account(accountId), year] as const,
};

export const dailySummaryKeys = {
  all: ["daily-summaries"] as const,
  account: (accountId: string) => [...dailySummaryKeys.all, accountId] as const,
  accountRange: (accountId: string, start?: string, end?: string) =>
    [...dailySummaryKeys.account(accountId), { start, end }] as const,
};

// Fetch monthly archives
async function fetchBalanceArchives(
  accountId: string,
  year?: number,
): Promise<BalanceArchive[]> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));

  const url = `/api/accounts/${accountId}/balance/archives${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }

  return res.json();
}

// Fetch daily summaries
async function fetchDailySummaries(
  accountId: string,
  options?: { start?: string; end?: string; limit?: number },
): Promise<DailySummary[]> {
  const params = new URLSearchParams();
  if (options?.start) params.set("start", options.start);
  if (options?.end) params.set("end", options.end);
  if (options?.limit) params.set("limit", String(options.limit));

  const url = `/api/accounts/${accountId}/balance/daily${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }

  return res.json();
}

// Generate archive for a specific month
async function generateArchive(
  accountId: string,
  yearMonth: string,
): Promise<BalanceArchive> {
  const res = await fetch(`/api/accounts/${accountId}/balance/archives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year_month: yearMonth }),
  });

  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Hook to fetch monthly balance archives for an account
 */
export function useBalanceArchives(
  accountId: string | undefined,
  year?: number,
) {
  return useQuery({
    queryKey: balanceArchiveKeys.accountYear(
      accountId || "",
      year || new Date().getFullYear(),
    ),
    queryFn: () => fetchBalanceArchives(accountId!, year),
    enabled: !!accountId,
    staleTime: CACHE_TIMES.BALANCE,
  });
}

/**
 * Hook to fetch daily summaries for an account
 */
export function useDailySummaries(
  accountId: string | undefined,
  options?: { start?: string; end?: string; limit?: number },
) {
  return useQuery({
    queryKey: dailySummaryKeys.accountRange(
      accountId || "",
      options?.start,
      options?.end,
    ),
    queryFn: () => fetchDailySummaries(accountId!, options),
    enabled: !!accountId,
    staleTime: CACHE_TIMES.BALANCE,
  });
}

/**
 * Hook to generate a monthly archive
 */
export function useGenerateArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      yearMonth,
    }: {
      accountId: string;
      yearMonth: string;
    }) => generateArchive(accountId, yearMonth),
    onSuccess: (_, { accountId }) => {
      queryClient.invalidateQueries({
        queryKey: balanceArchiveKeys.account(accountId),
      });
    },
  });
}

// Helper to format year-month
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Helper to get net change color
export function getNetChangeColor(amount: number): string {
  if (amount > 0) return "text-green-400";
  if (amount < 0) return "text-red-400";
  return "text-gray-400";
}
