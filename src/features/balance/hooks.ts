// src/features/balance/hooks.ts
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

// Types for balance history
export type BalanceChangeType =
  | "initial_set"
  | "manual_set"
  | "manual_adjustment"
  | "transfer_in"
  | "transfer_out"
  | "transaction_expense"
  | "transaction_income"
  | "transaction_deleted"
  | "split_bill_paid"
  | "split_bill_received"
  | "draft_confirmed"
  | "correction"
  | "debt_settled";

export interface BalanceHistoryTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  category_color: string | null;
}

export interface BalanceHistoryTransfer {
  id: string;
  description: string;
  amount: number;
  date: string;
  from_account_id: string | null;
  from_account_name: string | null;
  to_account_id: string | null;
  to_account_name: string | null;
}

export interface BalanceHistoryEntry {
  id: string;
  previous_balance: number;
  new_balance: number;
  change_amount: number;
  change_type: BalanceChangeType;
  reason: string | null;
  is_reconciliation: boolean;
  expected_balance: number | null;
  discrepancy_amount: number | null;
  discrepancy_explanation: string | null;
  effective_date: string;
  created_at: string;
  transaction: BalanceHistoryTransaction | null;
  transfer: BalanceHistoryTransfer | null;
}

export interface BalanceHistoryResponse {
  account_id: string;
  account_name: string;
  account_type: "income" | "expense" | "saving";
  current_balance: number;
  history: BalanceHistoryEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// Query keys
export const balanceHistoryKeys = {
  all: ["balance-history"] as const,
  account: (accountId: string) =>
    [...balanceHistoryKeys.all, accountId] as const,
  accountWithFilters: (
    accountId: string,
    filters?: {
      limit?: number;
      offset?: number;
      start?: string;
      end?: string;
      excludeTransactions?: boolean;
    },
  ) => [...balanceHistoryKeys.account(accountId), filters] as const,
};

// Fetch balance history
async function fetchBalanceHistory(
  accountId: string,
  options?: {
    limit?: number;
    offset?: number;
    start?: string;
    end?: string;
    excludeTransactions?: boolean;
  },
): Promise<BalanceHistoryResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (options?.start) params.set("start", options.start);
  if (options?.end) params.set("end", options.end);
  // By default, transactions are excluded (shown via daily summaries instead)
  if (options?.excludeTransactions === false) {
    params.set("exclude_transactions", "false");
  }

  const url = `/api/accounts/${accountId}/balance/history${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

// --------------- localStorage balance history cache ---------------
const BH_HIST_PREFIX = "bh-hist-";
const BH_HIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function getBhHistCacheKey(
  accountId: string,
  opts?: {
    limit?: number;
    offset?: number;
    start?: string;
    end?: string;
    excludeTransactions?: boolean;
  },
) {
  return `${BH_HIST_PREFIX}${accountId}_${opts?.start || "all"}_${opts?.end || "all"}_${opts?.excludeTransactions ?? true}`;
}

function readBhHistCache(
  key: string,
): { data: BalanceHistoryResponse; ts: number } | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > BH_HIST_MAX_AGE) {
      localStorage.removeItem(key);
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function writeBhHistCache(key: string, data: BalanceHistoryResponse) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearHistBhCache(accountId: string) {
  try {
    const prefix = `${BH_HIST_PREFIX}${accountId}`;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * Hook to fetch balance history for an account
 * By default, excludes individual transaction entries (shown via daily summaries)
 * Only shows: transfers, manual adjustments, reconciliations, initial balance
 */
export function useBalanceHistory(
  accountId: string | undefined,
  options?: {
    limit?: number;
    offset?: number;
    start?: string;
    end?: string;
    excludeTransactions?: boolean;
  },
) {
  const cacheKey = accountId ? getBhHistCacheKey(accountId, options) : "";

  return useQuery({
    queryKey: balanceHistoryKeys.accountWithFilters(accountId || "", options),
    queryFn: async () => {
      const data = await fetchBalanceHistory(accountId!, options);
      writeBhHistCache(cacheKey, data);
      return data;
    },
    enabled: !!accountId,
    initialData: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      return readBhHistCache(cacheKey)?.data;
    },
    initialDataUpdatedAt: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      return readBhHistCache(cacheKey)?.ts;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}

// Helper to get display info for change types
export function getChangeTypeInfo(changeType: BalanceChangeType): {
  label: string;
  icon: string;
  colorClass: string;
} {
  switch (changeType) {
    case "initial_set":
      return {
        label: "Initial Balance",
        icon: "star",
        colorClass: "text-blue-400",
      };
    case "manual_set":
      return {
        label: "Balance Set",
        icon: "pencil",
        colorClass: "text-amber-400",
      };
    case "manual_adjustment":
      return {
        label: "Manual Adjustment",
        icon: "settings",
        colorClass: "text-amber-400",
      };
    case "transfer_in":
      return {
        label: "Transfer In",
        icon: "arrow-down",
        colorClass: "text-green-400",
      };
    case "transfer_out":
      return {
        label: "Transfer Out",
        icon: "arrow-up",
        colorClass: "text-red-400",
      };
    case "transaction_expense":
      return {
        label: "Expense",
        icon: "zap",
        colorClass: "text-red-400",
      };
    case "transaction_income":
      return {
        label: "Income",
        icon: "plus",
        colorClass: "text-green-400",
      };
    case "transaction_deleted":
      return {
        label: "Transaction Deleted",
        icon: "x",
        colorClass: "text-gray-400",
      };
    case "split_bill_paid":
      return {
        label: "Split Bill Paid",
        icon: "users",
        colorClass: "text-purple-400",
      };
    case "split_bill_received":
      return {
        label: "Split Bill Received",
        icon: "users",
        colorClass: "text-green-400",
      };
    case "draft_confirmed":
      return {
        label: "Draft Confirmed",
        icon: "check",
        colorClass: "text-blue-400",
      };
    case "correction":
      return {
        label: "Correction",
        icon: "wrench",
        colorClass: "text-orange-400",
      };
    case "debt_settled":
      return {
        label: "Debt Settled",
        icon: "handshake",
        colorClass: "text-orange-400",
      };
    default:
      return {
        label: changeType,
        icon: "dot",
        colorClass: "text-gray-400",
      };
  }
}

// Format change amount with sign
export function formatChangeAmount(amount: number): string {
  const sign = amount >= 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}
