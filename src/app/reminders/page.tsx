"use client";

import FilterBar, {
  type FilterBarSection,
  type GroupMode,
  type RecurringFilter,
  type TypeFilter,
  type UserFilter,
} from "@/components/activity/FilterBar";
import ChoresTabContent from "@/components/chores/ChoresTabContent";
import MobileFlexibleAssignmentPage from "@/components/planner/MobileFlexibleAssignmentPage";
import WebDayPlanner, { type PlannerToolbarState } from "@/components/planner/WebDayPlanner";
import {
  AlertBellIcon,
  EyeIcon,
  EyeOffIcon,
  SparklesIcon,
} from "@/components/icons/FuturisticIcons";
import { itemsKeys } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { yyyyMmDd } from "@/lib/utils/date";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { parseISO } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type RemindersPage = "focus" | "chores" | "assign";

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

const ChoresIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 12l2-2 2 2 4-4" />
    <path d="M3 19l2-2 2 2 4-4" />
    <path d="M13 7h8M13 17h8" />
  </svg>
);

const AssignIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 10h18" />
    <path d="M9 15l2 2 4-5" />
  </svg>
);

const REMINDERS_SECTIONS: FilterBarSection[] = [
  { key: "focus", label: "Focus", Icon: FocusIcon, variant: "neutral" },
  { key: "chores", label: "Chores", Icon: ChoresIcon, variant: "neutral" },
  {
    key: "assign",
    label: "Assign",
    Icon: AssignIcon,
    variant: "neutral",
  },
];

const DEFAULT_PLANNER_TOOLBAR_STATE: PlannerToolbarState = {
  mode: "browsing",
  dayPlanLoading: true,
  overdueCount: 0,
  selectedIsToday: true,
};

export default function RemindersStandalonePage() {
  const searchParams = useSearchParams();
  const initialDate = useMemo(() => searchParams.get("date") ?? undefined, [searchParams]);
  const initialPlanning = useMemo(() => searchParams.get("plan") === "1", [searchParams]);
  const initialTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "chores" || tab === "assign" ? tab : undefined;
  }, [searchParams]);
  const themeClasses = useThemeClasses();

  const [mounted, setMounted] = useState(false);
  const [activePage, setActivePage] = useState<RemindersPage>(
    initialTab ?? "focus",
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    initialDate ? parseISO(initialDate) : new Date(),
  );
  const [showOverdue, setShowOverdue] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [planningCommandToken, setPlanningCommandToken] = useState(0);
  const [plannerToolbar, setPlannerToolbar] = useState<PlannerToolbarState>(
    DEFAULT_PLANNER_TOOLBAR_STATE,
  );
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
    setShowCompleted(localStorage.getItem("reminders-show-completed") === "1");
    const fetchUser = async () => {
      const supabase = supabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) setCurrentUserId(user.id);
    };
    fetchUser();
  }, []);

  const toggleShowCompleted = useCallback(() => {
    setShowCompleted((prev) => {
      const next = !prev;
      localStorage.setItem("reminders-show-completed", next ? "1" : "0");
      return next;
    });
  }, []);

  const handleToolbarStateChange = useCallback((next: PlannerToolbarState) => {
    setPlannerToolbar((previous) =>
      previous.mode === next.mode &&
      previous.dayPlanLoading === next.dayPlanLoading &&
      previous.overdueCount === next.overdueCount &&
      previous.selectedIsToday === next.selectedIsToday
        ? previous
        : next,
    );
  }, []);

  useEffect(() => {
    if (!plannerToolbar.selectedIsToday || plannerToolbar.overdueCount === 0) {
      setShowOverdue(false);
    }
  }, [plannerToolbar.overdueCount, plannerToolbar.selectedIsToday]);

  // Clean the URL params after reading them (captured into initialDate/initialPlanning/initialTab above)
  useEffect(() => {
    if (mounted && (initialDate || initialPlanning || initialTab)) {
      window.history.replaceState({}, "", "/reminders");
    }
  }, [mounted, initialDate, initialPlanning, initialTab]);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-16">
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
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-16">
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
        extraActions={
          activePage === "focus" || activePage === "chores" ? (
            <>
              {activePage === "focus" && (
                <button
                  type="button"
                  disabled={plannerToolbar.dayPlanLoading}
                  onClick={() => {
                    if (plannerToolbar.mode === "planning") return;
                    if (navigator.vibrate) navigator.vibrate(5);
                    setPlanningCommandToken((token) => token + 1);
                  }}
                  className={cn(
                    "relative p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed",
                    plannerToolbar.mode === "planning"
                      ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                      : `neo-card ${themeClasses.text} hover:bg-white/5`,
                  )}
                  title="Plan my day"
                  aria-label="Plan my day"
                >
                  <SparklesIcon className="w-4 h-4" />
                </button>
              )}

              {activePage === "focus" &&
                plannerToolbar.selectedIsToday &&
                plannerToolbar.overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(5);
                      setShowOverdue((visible) => !visible);
                    }}
                    className={cn(
                      "relative p-1.5 rounded-lg transition-colors flex-shrink-0",
                      showOverdue
                        ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                        : `neo-card ${themeClasses.text} hover:bg-white/5`,
                    )}
                    title={showOverdue ? "Hide overdue items" : "Show overdue items"}
                    aria-label={showOverdue ? "Hide overdue items" : "Show overdue items"}
                    aria-pressed={showOverdue}
                  >
                    <AlertBellIcon className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full neo-gradient text-[9px] leading-4 text-white font-bold text-center">
                      {plannerToolbar.overdueCount}
                    </span>
                  </button>
                )}

              <button
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(5);
                  toggleShowCompleted();
                }}
                className={cn(
                  "relative p-1.5 rounded-lg transition-colors flex-shrink-0",
                  showCompleted
                    ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
                title={showCompleted ? "Hide completed" : "Show completed"}
                aria-label={showCompleted ? "Hide completed" : "Show completed"}
                aria-pressed={showCompleted}
              >
                {showCompleted ? (
                  <EyeIcon className="w-4 h-4" />
                ) : (
                  <EyeOffIcon className="w-4 h-4" />
                )}
              </button>
            </>
          ) : null
        }
      />

      {activePage === "focus" ? (
        <WebDayPlanner
          initialDate={initialDate}
          initialPlanning={initialPlanning}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          showOverdue={showOverdue}
          showCompleted={showCompleted}
          planningCommandToken={planningCommandToken}
          onToolbarStateChange={handleToolbarStateChange}
          userFilter={userFilter}
          currentUserId={currentUserId}
          typeFilter={typeFilter}
          recurringFilter={recurringFilter}
        />
      ) : activePage === "chores" ? (
        <ChoresTabContent
          userFilter={userFilter}
          currentUserId={currentUserId}
          showCompleted={showCompleted}
        />
      ) : (
        <MobileFlexibleAssignmentPage
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          userFilter={userFilter}
          currentUserId={currentUserId}
          typeFilter={typeFilter}
          recurringFilter={recurringFilter}
        />
      )}
    </main>
  );
}
