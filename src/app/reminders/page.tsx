"use client";

import FilterBar, {
  type FilterBarSection,
  type GroupMode,
  type RecurringFilter,
  type TypeFilter,
  type UserFilter,
} from "@/components/activity/FilterBar";
import RemindersInsightsPage from "@/components/reminder/RemindersInsightsPage";
import StandaloneRemindersPage from "@/components/reminder/StandaloneRemindersPage";
import { itemsKeys } from "@/features/items/useItems";
import { supabaseBrowser } from "@/lib/supabase/client";
import { yyyyMmDd } from "@/lib/utils/date";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

type RemindersPage = "focus" | "insights";

// ─── Tab Icons ────────────────────────────────────────────────────────────────
const FocusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="8" strokeDasharray="4 4" />
  </svg>
);

const InsightsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 3v18h18" />
    <path d="M7 16l4-6 4 3 5-7" />
    <circle cx="20" cy="6" r="1.5" fill="currentColor" />
  </svg>
);

const REMINDERS_SECTIONS: FilterBarSection[] = [
  { key: "focus", label: "Focus", Icon: FocusIcon, variant: "neutral" },
  {
    key: "insights",
    label: "Insights",
    Icon: InsightsIcon,
    variant: "neutral",
  },
];

export default function RemindersStandalonePage() {
  const [mounted, setMounted] = useState(false);
  const [activePage, setActivePage] = useState<RemindersPage>("focus");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [recurringFilter, setRecurringFilter] =
    useState<RecurringFilter>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("time");

  const queryClient = useQueryClient();
  const isFetchingCount = useIsFetching({ queryKey: itemsKeys.all });
  const isFetching = isFetchingCount > 0;

  const thisMonthRange = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: yyyyMmDd(monthStart), end: yyyyMmDd(monthEnd) };
  }, []);
  const [dateRange, setDateRange] = useState(thisMonthRange);

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) setCurrentUserId(user.id);
    };
    fetchUser();
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-14">
        <div className="min-h-full p-4 pb-8 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 animate-pulse">
                <div className="h-8 bg-white/5 rounded mb-1" />
                <div className="h-3 bg-white/5 rounded w-12 mx-auto" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-white/5 animate-pulse h-14"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-14">
      <FilterBar
        userFilter={userFilter}
        onUserFilterChange={setUserFilter}
        sections={REMINDERS_SECTIONS}
        activeSection={activePage}
        onSectionChange={(key) => setActivePage(key as RemindersPage)}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        groupMode={groupMode}
        onGroupModeChange={setGroupMode}
        showGroupToggle={true}
        availableCategories={[]}
        categoryFilters={[]}
        onCategoryFiltersChange={() => {}}
        showCategoryFilter={false}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        recurringFilter={recurringFilter}
        onRecurringFilterChange={setRecurringFilter}
        showJournalFilters={true}
        isBlurred={false}
        onToggleBlur={() => {}}
        isBudgetSection={false}
        isFetching={isFetching}
        onRefresh={() => {
          if (navigator.vibrate) navigator.vibrate(5);
          queryClient.invalidateQueries({ queryKey: itemsKeys.all });
        }}
      />

      {activePage === "focus" ? (
        <StandaloneRemindersPage
          userFilter={userFilter}
          currentUserId={currentUserId}
          typeFilter={typeFilter}
          recurringFilter={recurringFilter}
        />
      ) : (
        <RemindersInsightsPage
          userFilter={userFilter}
          currentUserId={currentUserId}
          typeFilter={typeFilter}
          recurringFilter={recurringFilter}
        />
      )}
    </main>
  );
}
