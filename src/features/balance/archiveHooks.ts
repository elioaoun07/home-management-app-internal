// src/features/balance/archiveHooks.ts
"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

// Types for balance archives (aggregated from archived daily summaries)
export interface BalanceArchive {
  id: string;
  year_month: string;
  month_name: string;
  opening_balance: number;
  closing_balance: number;
  total_transaction_count: number;
  total_income: number;
  total_expenses: number;
  net_change: number;
  total_transfers_in: number;
  total_transfers_out: number;
  transfer_count: number;
}

export interface DailySummary {
  date: string;
  opening_balance: number;
  closing_balance: number;
  net_change: number;
  total_expenses: number;
  total_transfers_in: number;
  total_transfers_out: number;
  transaction_count: number;
  transfer_in_count: number;
  transfer_out_count: number;
  manual_change_count: number;
  transactions: DayTransaction[];
  transfers_in: DayTransferIn[];
  transfers_out: DayTransferOut[];
  manual_changes: DayManualChange[];
}

export interface DayTransaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  category_color: string;
}

export interface DayTransferIn {
  id: string;
  amount: number;
  description: string;
  from_account: string;
}

export interface DayTransferOut {
  id: string;
  amount: number;
  description: string;
  to_account: string;
}

export interface DayManualChange {
  id: string;
  change_amount: number;
  change_type: string;
  reason: string | null;
  previous_balance: number;
  new_balance: number;
  created_at: string;
}

export interface DailyResponse {
  current_balance: number;
  days: DailySummary[];
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

// --------------- localStorage balance cache ---------------
const BH_DAILY_PREFIX = "bh-daily-";
const BH_ARCHIVE_PREFIX = "bh-archive-";
const BH_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function getDailyCacheKey(accountId: string, start?: string, end?: string) {
  return `${BH_DAILY_PREFIX}${accountId}_${start || "all"}_${end || "all"}`;
}

function getArchiveCacheKey(accountId: string, year?: number) {
  return `${BH_ARCHIVE_PREFIX}${accountId}_${year || "all"}`;
}

function readBhCache<T>(key: string): { data: T; ts: number } | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > BH_CACHE_MAX_AGE) {
      localStorage.removeItem(key);
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function writeBhCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* quota exceeded — ignore */
  }
}

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
): Promise<DailyResponse> {
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
  const cacheKey = accountId ? getArchiveCacheKey(accountId, year) : "";

  return useQuery({
    queryKey: balanceArchiveKeys.accountYear(
      accountId || "",
      year || new Date().getFullYear(),
    ),
    queryFn: async () => {
      const data = await fetchBalanceArchives(accountId!, year);
      writeBhCache(cacheKey, data);
      return data;
    },
    enabled: !!accountId,
    initialData: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      return readBhCache<BalanceArchive[]>(cacheKey)?.data;
    },
    initialDataUpdatedAt: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      return readBhCache<BalanceArchive[]>(cacheKey)?.ts;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook to fetch daily summaries for an account
 */
export function useDailySummaries(
  accountId: string | undefined,
  options?: { start?: string; end?: string; limit?: number },
) {
  const cacheKey = accountId
    ? getDailyCacheKey(accountId, options?.start, options?.end)
    : "";

  return useQuery({
    queryKey: dailySummaryKeys.accountRange(
      accountId || "",
      options?.start,
      options?.end,
    ),
    queryFn: async () => {
      const data = await fetchDailySummaries(accountId!, options);
      writeBhCache(cacheKey, data);
      return data;
    },
    enabled: !!accountId,
    initialData: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      return readBhCache<DailyResponse>(cacheKey)?.data;
    },
    initialDataUpdatedAt: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      return readBhCache<DailyResponse>(cacheKey)?.ts;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
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
