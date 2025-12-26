/**
 * Hook for managing LBP (Lebanese Pound) exchange rate settings
 * Used for Lebanon dual-currency tracking where users pay in USD and receive LBP change
 */
"use client";

import { CACHE_TIMES, getCachedPreferences, setCachedPreferences } from "@/lib/queryConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const LS_KEY = "user_preferences";

export interface LbpSettings {
  /** LBP per USD rate in thousands (e.g., 90 = 90,000 LBP per 1 USD) */
  lbp_exchange_rate: number | null;
}

function readLocalLbpRate(): number | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.lbp_exchange_rate ?? null;
  } catch {
    return null;
  }
}

function writeLocalLbpRate(rate: number | null) {
  try {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    existing.lbp_exchange_rate = rate;
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

/**
 * Hook to get and set the LBP exchange rate
 * The rate is stored in thousands (e.g., 90 = 90,000 LBP per 1 USD)
 */
export function useLbpSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<LbpSettings>({
    queryKey: ["lbp-settings"],
    queryFn: async () => {
      const res = await fetch("/api/user-preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      const data = await res.json();
      console.log("LBP Settings fetched:", data);
      // Cache to localStorage
      setCachedPreferences(data);
      return { lbp_exchange_rate: data.lbp_exchange_rate ?? null };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - shorter for testing
  });

  const mutation = useMutation({
    mutationFn: async (rate: number | null) => {
      const res = await fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lbp_exchange_rate: rate }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update LBP rate");
      }
      return rate;
    },
    onMutate: async (rate) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["lbp-settings"] });
      const previous = queryClient.getQueryData<LbpSettings>(["lbp-settings"]);
      queryClient.setQueryData<LbpSettings>(["lbp-settings"], { lbp_exchange_rate: rate });
      writeLocalLbpRate(rate);
      return { previous };
    },
    onError: (_err, _rate, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["lbp-settings"], context.previous);
        writeLocalLbpRate(context.previous.lbp_exchange_rate);
      }
    },
    onSettled: () => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: ["lbp-settings"] });
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
    },
  });

  const setLbpRate = useCallback(
    (rate: number | null) => {
      mutation.mutate(rate);
    },
    [mutation]
  );

  /**
   * Calculate actual USD value given amount paid and LBP change received
   * @param amountPaid The USD amount paid
   * @param lbpChangeReceived The LBP change received (in thousands, e.g., 600 = 600,000 LBP)
   * @returns The actual USD value of the item, or null if rate not set
   */
  const calculateActualValue = useCallback(
    (amountPaid: number, lbpChangeReceived: number | null): number | null => {
      if (!lbpChangeReceived || !query.data?.lbp_exchange_rate) {
        return null;
      }
      // lbpChangeReceived is in thousands (600 = 600,000 LBP)
      // lbp_exchange_rate is in thousands (90 = 90,000 LBP per USD)
      const changeInUsd = lbpChangeReceived / query.data.lbp_exchange_rate;
      return Math.round((amountPaid - changeInUsd) * 100) / 100; // Round to 2 decimals
    },
    [query.data?.lbp_exchange_rate]
  );

  return {
    /** The current LBP exchange rate (in thousands, e.g., 90 = 90,000 LBP per 1 USD) */
    lbpRate: query.data?.lbp_exchange_rate ?? null,
    /** Whether we have a rate set */
    hasLbpRate: !!query.data?.lbp_exchange_rate,
    /** Set the LBP exchange rate (in thousands) */
    setLbpRate,
    /** Calculate actual USD value given amount paid and LBP change */
    calculateActualValue,
    /** Whether the rate is being updated */
    isUpdating: mutation.isPending,
    /** Whether the settings are loading */
    isLoading: query.isLoading,
  };
}
