"use client";

import EnhancedMobileDashboard from "@/components/dashboard/EnhancedMobileDashboard";
import { ItemsDashboard } from "@/components/items";
import AppModeToggle, {
  ViewModeSelector,
} from "@/components/navigation/AppModeToggle";
import { useAppMode } from "@/contexts/AppModeContext";
import { useUserPreferences } from "@/features/preferences/useUserPreferences";
import { useDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getDefaultDateRange } from "@/lib/utils/date";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function DashboardClientPage() {
  const themeClasses = useThemeClasses();
  const router = useRouter();
  const { appMode, isBudgetMode, isItemsMode } = useAppMode();
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined
  );
  const [viewMode, setViewMode] = useState<"agenda" | "schedule" | "calendar">(
    "agenda"
  );
  const { data: preferences } = useUserPreferences();

  const defaultRange = useMemo(
    () => getDefaultDateRange(monthStartDay),
    [monthStartDay]
  );

  const [dateRange, setDateRange] = useState(defaultRange);

  // Fetch current user ID from Supabase auth
  useEffect(() => {
    const fetchUserId = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        setCurrentUserId(user.id);
      }
    };
    fetchUserId();
  }, []);

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

  // ONLY show skeleton if we're loading AND have no cached data
  if (isLoading && transactions.length === 0) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBg} p-4`}>
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header Skeleton */}
          <div
            className={`h-12 ${themeClasses.surfaceBg} rounded-lg animate-pulse`}
          />

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-24 ${themeClasses.surfaceBg} rounded-lg animate-pulse`}
              />
            ))}
          </div>

          {/* Chart Skeleton */}
          <div
            className={`h-64 ${themeClasses.surfaceBg} rounded-lg animate-pulse`}
          />

          {/* Transactions List Skeleton */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`h-16 ${themeClasses.surfaceBg} rounded-lg animate-pulse`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className={`min-h-screen ${themeClasses.pageBg} flex items-center justify-center p-4`}
      >
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">
            Failed to load dashboard
          </div>
          <div className={`${themeClasses.headerText} text-sm mb-4`}>
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

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ start, end });
    // Update URL for shareable links
    const url = new URL(window.location.href);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 pt-14">
      {/* App Mode Toggle Header - positioned below main app header */}
      <div
        className={cn(
          "sticky top-14 z-30 py-3 px-4",
          "bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md",
          "border-b border-white/5"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <AppModeToggle />
          <ViewModeSelector
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {/* Conditional Dashboard Content */}
      {isBudgetMode ? (
        <EnhancedMobileDashboard
          transactions={transactions}
          startDate={dateRange.start}
          endDate={dateRange.end}
          currentUserId={currentUserId}
          onDateRangeChange={handleDateRangeChange}
        />
      ) : (
        <ItemsDashboard
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
