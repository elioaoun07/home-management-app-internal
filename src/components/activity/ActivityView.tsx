"use client";

import { DollarSignIcon } from "@/components/icons/FuturisticIcons";
import { useAppModeSafe } from "@/contexts/AppModeContext";
import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import { itemsKeys } from "@/features/items/useItems";
import { useDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { yyyyMmDd } from "@/lib/utils/date";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import FilterBar, {
  type FilterBarSection,
  type GroupMode,
  type RecurringFilter,
  type TypeFilter,
  type UserFilter,
} from "./FilterBar";
import ItemsListView from "./ItemsListView";
import TransactionListView from "./TransactionListView";
import TransferListView from "./TransferListView";

type ActiveSection = "transactions" | "transfers" | "items";

// ─── Inline Icons ─────────────────────────────────────────────────────────────
const TransferArrowsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const JournalIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const FILTER_SECTIONS: FilterBarSection[] = [
  {
    key: "transactions",
    label: "Spending",
    Icon: DollarSignIcon,
    variant: "budget",
  },
  {
    key: "transfers",
    label: "Transfers",
    Icon: TransferArrowsIcon,
    variant: "budget",
  },
  { key: "items", label: "Journal", Icon: JournalIcon, variant: "journal" },
];

export default function ActivityView() {
  const themeClasses = useThemeClasses();
  const { isBlurred, toggleBlur } = usePrivacyBlur();
  const queryClient = useQueryClient();
  const appModeCtx = useAppModeSafe();

  const [activeSection, setActiveSection] = useState<ActiveSection>(
    appModeCtx?.isItemsMode ? "items" : "transactions",
  );

  // Sync active section when the FAB mode changes
  useEffect(() => {
    if (appModeCtx?.isItemsMode) {
      setActiveSection("items");
    } else if (appModeCtx?.isBudgetMode) {
      setActiveSection("transactions");
    }
  }, [appModeCtx?.isItemsMode, appModeCtx?.isBudgetMode]);

  // Reverse sync: when user manually switches section, update appMode so the header follows
  const setAppModeFn = appModeCtx?.setAppMode;
  useEffect(() => {
    setAppModeFn?.(activeSection === "items" ? "items" : "budget");
  }, [activeSection, setAppModeFn]);
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [groupMode, setGroupMode] = useState<GroupMode>("time");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [recurringFilter, setRecurringFilter] =
    useState<RecurringFilter>("all");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);

  const thisMonthRange = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: yyyyMmDd(monthStart), end: yyyyMmDd(monthEnd) };
  }, []);
  const [dateRange, setDateRange] = useState(thisMonthRange);

  const isFetchingTx = useIsFetching({
    queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
  });
  const isFetchingTr = useIsFetching({ queryKey: ["transfers"] });
  const isFetchingItems = useIsFetching({ queryKey: itemsKeys.all });
  const isFetching =
    isFetchingTx > 0 || isFetchingTr > 0 || isFetchingItems > 0;

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.id) setCurrentUserId(user.id);
      });
  }, []);

  const handleRefresh = () => {
    if (navigator.vibrate) navigator.vibrate(5);
    queryClient.invalidateQueries({
      queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
    });
    queryClient.invalidateQueries({ queryKey: ["transfers"] });
    if (activeSection === "items") {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    }
  };

  const activeIsJournal = activeSection === "items";

  const { data: txData = [] } = useDashboardTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });
  const availableCategories = useMemo(() => {
    const seen = new Map<string, string>();
    txData.forEach((tx) => {
      if (tx.category) seen.set(tx.category, tx.category_color || "#94a3b8");
    });
    return Array.from(seen.entries())
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [txData]);

  return (
    <div className={`min-h-screen ${themeClasses.pageBg} pt-16 pb-24`}>
      <FilterBar
        userFilter={userFilter}
        onUserFilterChange={setUserFilter}
        sections={FILTER_SECTIONS}
        activeSection={activeSection}
        onSectionChange={(key) => setActiveSection(key as ActiveSection)}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        groupMode={groupMode}
        onGroupModeChange={setGroupMode}
        showGroupToggle={true}
        availableCategories={availableCategories}
        categoryFilters={categoryFilters}
        onCategoryFiltersChange={setCategoryFilters}
        showCategoryFilter={activeSection === "transactions"}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        recurringFilter={recurringFilter}
        onRecurringFilterChange={setRecurringFilter}
        showJournalFilters={activeSection === "items"}
        isBlurred={isBlurred}
        onToggleBlur={toggleBlur}
        isBudgetSection={!activeIsJournal}
        isFetching={isFetching}
        onRefresh={handleRefresh}
      />

      {/* Content */}
      <div className="px-4 pt-3">
        {activeSection === "transactions" ? (
          <TransactionListView
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
            userFilter={userFilter}
            groupMode={groupMode}
            categoryFilters={categoryFilters}
          />
        ) : activeSection === "transfers" ? (
          <TransferListView
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
            userFilter={userFilter}
          />
        ) : (
          <ItemsListView
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
            userFilter={userFilter}
            typeFilter={typeFilter}
            recurringFilter={recurringFilter}
            groupMode={groupMode}
          />
        )}
      </div>
    </div>
  );
}
