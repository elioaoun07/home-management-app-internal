"use client";

import {
  CalendarIcon,
  ChevronDownIcon,
  DollarSignIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshIcon,
} from "@/components/icons/FuturisticIcons";
import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import { itemsKeys } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { yyyyMmDd } from "@/lib/utils/date";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import ItemsListView from "./ItemsListView";
import TransactionListView from "./TransactionListView";
import TransferListView from "./TransferListView";

type ActiveSection = "transactions" | "transfers" | "items";
type UserFilter = "all" | "mine" | "partner";

function getDatePresets() {
  const today = new Date();
  const todayStr = yyyyMmDd(today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const weekStart = new Date(today);
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday start
  weekStart.setDate(weekStart.getDate() - diff);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);

  return [
    { label: "Today", start: todayStr, end: todayStr },
    {
      label: "Yesterday",
      start: yyyyMmDd(yesterday),
      end: yyyyMmDd(yesterday),
    },
    { label: "This Week", start: yyyyMmDd(weekStart), end: yyyyMmDd(weekEnd) },
    {
      label: "Last Week",
      start: yyyyMmDd(lastWeekStart),
      end: yyyyMmDd(lastWeekEnd),
    },
    {
      label: "This Month",
      start: yyyyMmDd(monthStart),
      end: yyyyMmDd(monthEnd),
    },
    {
      label: "Last Month",
      start: yyyyMmDd(lastMonthStart),
      end: yyyyMmDd(lastMonthEnd),
    },
    { label: "3 Months", start: yyyyMmDd(threeMonthsAgo), end: todayStr },
  ];
}

// Inline transfer arrows icon (no existing one fits)
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

const SECTIONS = [
  {
    key: "transactions" as const,
    label: "Spending",
    Icon: DollarSignIcon,
    isBudget: true,
  },
  {
    key: "transfers" as const,
    label: "Transfers",
    Icon: TransferArrowsIcon,
    isBudget: true,
  },
  {
    key: "items" as const,
    label: "Journal",
    Icon: JournalIcon,
    isBudget: false,
  },
];

const USER_FILTERS: { key: UserFilter; label: string }[] = [
  { key: "mine", label: "Me" },
  { key: "all", label: "Both" },
  { key: "partner", label: "Partner" },
];

export default function ActivityView() {
  const themeClasses = useThemeClasses();
  const { isBlurred, toggleBlur } = usePrivacyBlur();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] =
    useState<ActiveSection>("transactions");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => getDatePresets(), []);
  const todayStr = useMemo(() => yyyyMmDd(new Date()), []);
  const [dateRange, setDateRange] = useState({
    start: todayStr,
    end: todayStr,
  });

  // Track if transactions/transfers/items are currently fetching (for refresh indicator)
  const isFetchingTx = useIsFetching({
    queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
  });
  const isFetchingTr = useIsFetching({
    queryKey: ["transfers"],
  });
  const isFetchingItems = useIsFetching({
    queryKey: itemsKeys.all,
  });
  const isFetching =
    isFetchingTx > 0 || isFetchingTr > 0 || isFetchingItems > 0;

  // Close date picker when clicking outside
  useEffect(() => {
    if (!showDatePicker) return;
    const handler = (e: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(e.target as Node)
      ) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePicker]);

  const activeDateLabel = useMemo(() => {
    const match = presets.find(
      (p) => p.start === dateRange.start && p.end === dateRange.end,
    );
    return match?.label ?? "Custom";
  }, [presets, dateRange]);

  const handleRefresh = () => {
    if (navigator.vibrate) navigator.vibrate(5);
    queryClient.invalidateQueries({
      queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
    });
    queryClient.invalidateQueries({
      queryKey: ["transfers"],
    });
    if (activeSection === "items") {
      queryClient.invalidateQueries({ queryKey: itemsKeys.all });
    }
  };

  // Fetch current user ID
  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.id) setCurrentUserId(user.id);
      });
  }, []);

  const activeIsJournal = activeSection === "items";

  return (
    <div className={`min-h-screen ${themeClasses.pageBg} pt-14 pb-24`}>
      {/* Header bar */}
      <div
        className={cn(
          "sticky top-14 z-30 px-4 py-3",
          "bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md",
          "border-b border-white/5",
        )}
      >
        {/* Row 1: Segmented control + action buttons */}
        <div className="flex items-center gap-2 mb-3">
          {/* Segmented Control */}
          <div className="flex gap-0.5 neo-card rounded-xl p-1 flex-1">
            {SECTIONS.map(({ key, label, Icon, isBudget }, idx) => {
              const isActive = activeSection === key;
              // Visual separator between Transfers and Journal
              const showDivider = idx === 2;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center flex-1",
                    showDivider && "border-l border-white/10 pl-0.5 ml-0.5",
                  )}
                >
                  <button
                    onClick={() => setActiveSection(key)}
                    className={cn(
                      "w-full flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isActive
                        ? isBudget
                          ? "neo-gradient text-white shadow-sm"
                          : "bg-violet-500/25 text-violet-300 shadow-sm"
                        : `${themeClasses.text} hover:bg-white/5`,
                    )}
                  >
                    <Icon className="w-3 h-3 flex-shrink-0" />
                    <span>{label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Refresh + Eye */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                `neo-card ${themeClasses.text} hover:bg-white/5`,
                isFetching && "opacity-60",
              )}
              title="Refresh data"
            >
              <RefreshIcon
                className={cn("w-4 h-4", isFetching && "animate-spin")}
              />
            </button>

            {/* Eye only visible on budget sections */}
            {!activeIsJournal && (
              <button
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(5);
                  toggleBlur();
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  isBlurred
                    ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
                title={isBlurred ? "Show amounts" : "Hide amounts"}
              >
                {isBlurred ? (
                  <EyeOffIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: User toggle + Date button */}
        <div className="flex items-center justify-between gap-2">
          {/* Me / Both / Partner toggle */}
          <div className="flex gap-0.5 neo-card rounded-xl p-0.5">
            {USER_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setUserFilter(key)}
                className={cn(
                  "px-3 py-1 rounded-lg text-[11px] font-medium transition-all",
                  userFilter === key
                    ? "neo-gradient text-white shadow-sm"
                    : `${themeClasses.text} hover:bg-white/5`,
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date picker button */}
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all neo-card",
                showDatePicker
                  ? `${themeClasses.textActive}`
                  : themeClasses.text,
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" size={14} />
              <span>{activeDateLabel}</span>
              <ChevronDownIcon
                className={cn(
                  "w-3 h-3 transition-transform",
                  showDatePicker && "rotate-180",
                )}
                size={12}
              />
            </button>

            {/* Date preset dropdown */}
            {showDatePicker && (
              <div
                className={cn(
                  "absolute right-0 top-full mt-1.5 z-50",
                  "rounded-xl p-2 min-w-[160px]",
                  "bg-[#1a1a2e] backdrop-blur-xl",
                  "border border-white/10 shadow-xl",
                )}
              >
                <div className="flex flex-col gap-0.5">
                  {presets.map((preset) => {
                    const isActive =
                      dateRange.start === preset.start &&
                      dateRange.end === preset.end;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setDateRange({
                            start: preset.start,
                            end: preset.end,
                          });
                          setShowDatePicker(false);
                        }}
                        className={cn(
                          "text-left px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                          isActive
                            ? "neo-gradient text-white"
                            : `${themeClasses.text} hover:bg-white/5`,
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3">
        {activeSection === "transactions" ? (
          <TransactionListView
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
            userFilter={userFilter}
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
          />
        )}
      </div>
    </div>
  );
}
