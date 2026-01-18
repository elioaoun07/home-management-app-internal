// src/features/balance/hooks.ts
"use client";

import { CACHE_TIMES } from "@/lib/queryConfig";
import { useQuery } from "@tanstack/react-query";

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
  | "correction";

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
  return useQuery({
    queryKey: balanceHistoryKeys.accountWithFilters(accountId || "", options),
    queryFn: () => fetchBalanceHistory(accountId!, options),
    enabled: !!accountId,
    staleTime: CACHE_TIMES.BALANCE,
    refetchOnMount: true,
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
        icon: "✨",
        colorClass: "text-blue-400",
      };
    case "manual_set":
      return {
        label: "Balance Set",
        icon: "✎",
        colorClass: "text-amber-400",
      };
    case "manual_adjustment":
      return {
        label: "Manual Adjustment",
        icon: "⚙️",
        colorClass: "text-amber-400",
      };
    case "transfer_in":
      return {
        label: "Transfer In",
        icon: "↓",
        colorClass: "text-green-400",
      };
    case "transfer_out":
      return {
        label: "Transfer Out",
        icon: "↑",
        colorClass: "text-red-400",
      };
    case "transaction_expense":
      return {
        label: "Expense",
        icon: "💸",
        colorClass: "text-red-400",
      };
    case "transaction_income":
      return {
        label: "Income",
        icon: "💰",
        colorClass: "text-green-400",
      };
    case "transaction_deleted":
      return {
        label: "Transaction Deleted",
        icon: "🗑️",
        colorClass: "text-gray-400",
      };
    case "split_bill_paid":
      return {
        label: "Split Bill Paid",
        icon: "👥",
        colorClass: "text-purple-400",
      };
    case "split_bill_received":
      return {
        label: "Split Bill Received",
        icon: "👥",
        colorClass: "text-green-400",
      };
    case "draft_confirmed":
      return {
        label: "Draft Confirmed",
        icon: "✓",
        colorClass: "text-blue-400",
      };
    case "correction":
      return {
        label: "Correction",
        icon: "🔧",
        colorClass: "text-orange-400",
      };
    default:
      return {
        label: changeType,
        icon: "•",
        colorClass: "text-gray-400",
      };
  }
}

// Format change amount with sign
export function formatChangeAmount(amount: number): string {
  const sign = amount >= 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}
