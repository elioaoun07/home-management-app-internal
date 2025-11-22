"use client";

import EnhancedMobileDashboard from "@/components/dashboard/EnhancedMobileDashboard";
import { useUserPreferences } from "@/features/preferences/useUserPreferences";
import { useDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { getDefaultDateRange } from "@/lib/utils/date";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function DashboardClientPage() {
  const router = useRouter();
  const [monthStartDay, setMonthStartDay] = useState(1);
  const { data: preferences } = useUserPreferences();

  const defaultRange = useMemo(
    () => getDefaultDateRange(monthStartDay),
    [monthStartDay]
  );

  const [dateRange, setDateRange] = useState(defaultRange);

  // Update month start day from preferences
  useEffect(() => {
    if (preferences?.date_start) {
      const dateStart = preferences.date_start;
      const match = dateStart.match(/^(sun|mon)-(\d{1,2})$/);
      if (match) {
        const day = Number(match[2]);
        if (day >= 1 && day <= 28) {
          setMonthStartDay(day);
          const range = getDefaultDateRange(day);
          setDateRange(range);
        }
      }
    }
  }, [preferences]);

  // Parse URL search params for date range
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const start = params.get("start");
      const end = params.get("end");

      if (start && end) {
        setDateRange({ start, end });
      }
    }
  }, []);

  const {
    data: transactions = [],
    isLoading,
    isFetching,
    isError,
    error,
  } = useDashboardTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Extract current user ID from transactions (first transaction with matching user will be current user)
  // In a household setup, we need to identify which transactions belong to the current user
  // The API returns user_id for each transaction
  const currentUserId = useMemo(() => {
    // Try to get from localStorage first (more reliable)
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("supabase.auth.token");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const userId = parsed?.currentSession?.user?.id;
          if (userId) return userId;
        } catch (e) {
          // Fallback below
        }
      }
    }
    // Fallback: find user_id that appears most frequently (likely current user's)
    if (transactions.length > 0) {
      const userCounts: Record<string, number> = {};
      transactions.forEach((tx: any) => {
        if (tx.user_id) {
          userCounts[tx.user_id] = (userCounts[tx.user_id] || 0) + 1;
        }
      });
      const sorted = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) return sorted[0][0];
    }
    return undefined;
  }, [transactions]);

  // ONLY show skeleton if we're loading AND have no cached data
  if (isLoading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a1628] p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header Skeleton */}
          <div className="h-12 bg-[#1a2942] rounded-lg animate-pulse" />

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-[#1a2942] rounded-lg animate-pulse"
              />
            ))}
          </div>

          {/* Chart Skeleton */}
          <div className="h-64 bg-[#1a2942] rounded-lg animate-pulse" />

          {/* Transactions List Skeleton */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 bg-[#1a2942] rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">
            Failed to load dashboard
          </div>
          <div className="text-[#38bdf8] text-sm mb-4">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
          <button
            onClick={() => router.push("/expense")}
            className="px-4 py-2 bg-[#3b82f6] text-white rounded-lg hover:bg-[#3b82f6]/90"
          >
            Go to Add Expense
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <EnhancedMobileDashboard
        transactions={transactions}
        startDate={dateRange.start}
        endDate={dateRange.end}
        currentUserId={currentUserId}
      />
    </div>
  );
}
