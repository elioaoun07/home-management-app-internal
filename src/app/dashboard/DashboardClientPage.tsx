"use client";

import React from "react";
import EnhancedMobileDashboard from "@/components/dashboard/EnhancedMobileDashboard";
import ReviewDashboard from "@/components/dashboard-v2/ReviewDashboard";
import ItemsListView from "@/components/activity/ItemsListView";
import FilterBar, {
  type FilterBarSection,
  type GroupMode,
  type RecurringFilter,
  type TypeFilter,
  type UserFilter,
} from "@/components/activity/FilterBar";
import { useAppMode } from "@/contexts/AppModeContext";
import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import { useUserPreferences } from "@/features/preferences/useUserPreferences";
import { useDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { useFuturePaymentAlerts } from "@/hooks/useFuturePaymentAlerts";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getDefaultDateRange, yyyyMmDd } from "@/lib/utils/date";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type DashMode = "overview" | "list" | "journal" | "review";

// ─── Tab Icons ────────────────────────────────────────────────────────────────
const OverviewIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ListIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const JournalIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ReviewIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2" strokeWidth="1.5" />
  </svg>
);

const DASH_SECTIONS: FilterBarSection[] = [
  { key: "overview", label: "Overview", Icon: OverviewIcon, variant: "neutral" },
  { key: "review", label: "Review", Icon: ReviewIcon, variant: "neutral" },
  { key: "list", label: "List", Icon: ListIcon, variant: "neutral" },
  { key: "journal", label: "Journal", Icon: JournalIcon, variant: "journal" },
];

// Map dashMode to EnhancedMobileDashboard's viewMode (review handled separately)
const VIEW_MODE_MAP: Record<"overview" | "list", "widgets" | "list"> = {
  overview: "widgets",
  list: "list",
};

// Helper to get "This Week" date range
function getThisWeekRange(): { start: string; end: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - diff);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: yyyyMmDd(weekStart),
    end: yyyyMmDd(weekEnd),
  };
}

// Helper to get "This Month" date range
function getThisMonthRange(monthStartDay: number): { start: string; end: string } {
  const now = new Date();
  const currentDay = now.getDate();

  let monthStart = new Date(now);
  if (currentDay >= monthStartDay) {
    monthStart.setDate(monthStartDay);
  } else {
    monthStart.setMonth(monthStart.getMonth() - 1);
    monthStart.setDate(monthStartDay);
  }

  let monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(monthStartDay - 1);

  return {
    start: yyyyMmDd(monthStart),
    end: yyyyMmDd(monthEnd),
  };
}

export default function DashboardClientPage() {
  const themeClasses = useThemeClasses();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setAppMode } = useAppMode();
  const { isBlurred, toggleBlur } = usePrivacyBlur();
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [dashMode, setDashMode] = useState<DashMode>("overview");
  const { data: preferences } = useUserPreferences();

  // Filter state
  const [ownershipFilter, setOwnershipFilter] = useState<UserFilter>("all");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [recurringFilter, setRecurringFilter] = useState<RecurringFilter>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("time");
  const [hasUrlParams, setHasUrlParams] = useState(false);

  useFuturePaymentAlerts();

  const defaultRange = useMemo(() => getDefaultDateRange(monthStartDay), [monthStartDay]);
  const [dateRange, setDateRange] = useState(defaultRange);

  // Sync appMode context so FAB knows the right mode
  useEffect(() => {
    setAppMode(dashMode === "journal" ? "items" : "budget");
  }, [dashMode, setAppMode]);

  // Change default date range based on dashMode
  useEffect(() => {
    if (hasUrlParams) return; // Don't override URL params

    if (dashMode === "journal") {
      setDateRange(getThisWeekRange());
    } else {
      setDateRange(getThisMonthRange(monthStartDay));
    }
  }, [dashMode, monthStartDay, hasUrlParams]);

  useEffect(() => {
    const fetchUserId = async () => {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) setCurrentUserId(user.id);
    };
    fetchUserId();
  }, []);

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const start = params.get("start");
      const end = params.get("end");
      if (start && end) {
        setDateRange({ start, end });
        setHasUrlParams(true);
      }
    }
  }, []);

  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
  } = useDashboardTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const isFetchingCount = useIsFetching({
    queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
  });
  const isFetching = isFetchingCount > 0;

  const availableCategories = useMemo(() => {
    const seen = new Map<string, string>();
    transactions.forEach((tx) => {
      if (tx.category) seen.set(tx.category, tx.category_color || "#94a3b8");
    });
    return Array.from(seen.entries())
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  if (isLoading && transactions.length === 0) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBg} p-4`}>
        <div className="max-w-7xl mx-auto space-y-4">
          <div className={`h-12 ${themeClasses.surfaceBg} rounded-lg animate-pulse`} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-24 ${themeClasses.surfaceBg} rounded-lg animate-pulse`} />
            ))}
          </div>
          <div className={`h-64 ${themeClasses.surfaceBg} rounded-lg animate-pulse`} />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`h-16 ${themeClasses.surfaceBg} rounded-lg animate-pulse`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBg} flex items-center justify-center p-4`}>
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">Failed to load dashboard</div>
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
    const url = new URL(window.location.href);
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="pt-16">
      <FilterBar
        userFilter={ownershipFilter}
        onUserFilterChange={setOwnershipFilter}
        sections={DASH_SECTIONS}
        activeSection={dashMode}
        onSectionChange={(key) => setDashMode(key as DashMode)}
        dateRange={dateRange}
        onDateRangeChange={(r) => handleDateRangeChange(r.start, r.end)}
        groupMode={groupMode}
        onGroupModeChange={setGroupMode}
        showGroupToggle={dashMode === "list" || dashMode === "overview"}
        availableCategories={availableCategories}
        categoryFilters={categoryFilters}
        onCategoryFiltersChange={setCategoryFilters}
        showCategoryFilter={dashMode === "list" || dashMode === "overview" || dashMode === "review"}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        recurringFilter={recurringFilter}
        onRecurringFilterChange={setRecurringFilter}
        showJournalFilters={dashMode === "journal"}
        isBlurred={isBlurred}
        onToggleBlur={toggleBlur}
        isBudgetSection={dashMode !== "journal"}
        isFetching={isFetching}
        onRefresh={() => {
          if (navigator.vibrate) navigator.vibrate(5);
          queryClient.invalidateQueries({
            queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
          });
        }}
      />

      {/* Content */}
      {dashMode === "journal" ? (
        <div className="px-4 pt-3 pb-24">
          <ItemsListView
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
            userFilter={ownershipFilter}
            typeFilter={typeFilter}
            recurringFilter={recurringFilter}
            groupMode={groupMode}
          />
        </div>
      ) : dashMode === "review" ? (
        <div className="px-3 pt-4 pb-24">
          <ReviewDashboard
            transactions={transactions}
            startDate={dateRange.start}
            endDate={dateRange.end}
            ownershipFilter={ownershipFilter}
          />
        </div>
      ) : (
        <EnhancedMobileDashboard
          transactions={transactions}
          startDate={dateRange.start}
          endDate={dateRange.end}
          currentUserId={currentUserId}
          onDateRangeChange={handleDateRangeChange}
          controlledViewMode={VIEW_MODE_MAP[dashMode as "overview" | "list"]}
          externalOwnershipFilter={ownershipFilter}
          externalCategoryFilters={categoryFilters}
          groupMode={groupMode}
        />
      )}
    </div>
  );
}
