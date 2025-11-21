"use client";

import EnhancedMobileDashboard from "@/components/dashboard/EnhancedMobileDashboard";
import { useDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfCustomMonth(date: Date, monthStartDay: number) {
  const d = new Date(date);
  const currentDay = d.getDate();
  const s = new Date(d);
  if (currentDay >= monthStartDay) {
    s.setDate(monthStartDay);
  } else {
    s.setMonth(s.getMonth() - 1);
    s.setDate(monthStartDay);
  }
  s.setHours(0, 0, 0, 0);
  return s;
}

function getDefaultDateRange(monthStartDay: number = 1) {
  const now = new Date();
  const sCustom = startOfCustomMonth(now, monthStartDay);
  const nextPeriod = new Date(sCustom);
  nextPeriod.setMonth(nextPeriod.getMonth() + 1);
  nextPeriod.setDate(monthStartDay);
  const endOfPeriod = new Date(nextPeriod);
  endOfPeriod.setDate(endOfPeriod.getDate() - 1);
  return {
    start: fmtDate(sCustom),
    end: fmtDate(endOfPeriod),
  };
}

export default function DashboardClientPage() {
  const router = useRouter();
  const [monthStartDay, setMonthStartDay] = useState(1);

  const defaultRange = useMemo(
    () => getDefaultDateRange(monthStartDay),
    [monthStartDay]
  );

  const [dateRange, setDateRange] = useState(defaultRange);

  // Load user preferences for month start day (non-blocking)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/user-preferences");
        if (response.ok) {
          const prefs = await response.json();
          const dateStart = prefs?.date_start;
          if (dateStart && typeof dateStart === "string") {
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
        }
      } catch (error) {
        console.error("Failed to load user preferences:", error);
      }
    };

    // Load in background, don't block UI
    loadPreferences();
  }, []);

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
    <EnhancedMobileDashboard
      transactions={transactions}
      startDate={dateRange.start}
      endDate={dateRange.end}
      currentUserId={currentUserId}
    />
  );
}
