"use client";

import {
  AlertBellIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  FilterIcon,
  ListIcon,
  RefreshIcon,
  RotateCcwIcon,
  XIcon,
  ZapIcon,
} from "@/components/icons/FuturisticIcons";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { yyyyMmDd } from "@/lib/utils/date";
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type UserFilter = "all" | "mine" | "partner";
export type GroupMode = "time" | "category";
export type TypeFilter = "all" | "reminder" | "task" | "event";
export type RecurringFilter = "all" | "recurring" | "one-time";

export interface FilterBarSection {
  key: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
  variant: "budget" | "journal" | "neutral";
}

export interface FilterBarProps {
  userFilter: UserFilter;
  onUserFilterChange: (v: UserFilter) => void;

  sections: FilterBarSection[];
  activeSection: string;
  onSectionChange: (key: string) => void;

  dateRange: { start: string; end: string };
  onDateRangeChange: (r: { start: string; end: string }) => void;

  groupMode: GroupMode;
  onGroupModeChange: (m: GroupMode) => void;
  showGroupToggle?: boolean;

  availableCategories: { name: string; color: string }[];
  categoryFilters: string[];
  onCategoryFiltersChange: (f: string[]) => void;
  showCategoryFilter?: boolean;

  typeFilter: TypeFilter;
  onTypeFilterChange: (f: TypeFilter) => void;
  recurringFilter: RecurringFilter;
  onRecurringFilterChange: (f: RecurringFilter) => void;
  showJournalFilters?: boolean;

  isBlurred: boolean;
  onToggleBlur: () => void;
  isBudgetSection: boolean;

  isFetching: boolean;
  onRefresh: () => void;
}

// ─── Inline Icons ─────────────────────────────────────────────────────────────
const UserIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const GroupTimeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const GroupCatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const TagIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

// ─── Date Presets ─────────────────────────────────────────────────────────────
function getDatePresets() {
  const today = new Date();
  const todayStr = yyyyMmDd(today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const weekStart = new Date(today);
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
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
  ];
}

const TYPE_FILTERS: {
  key: TypeFilter;
  label: string;
  Icon: React.FC<{ className?: string }>;
  color: string;
}[] = [
  { key: "all", label: "All", Icon: ListIcon, color: "text-white/50" },
  {
    key: "reminder",
    label: "Reminders",
    Icon: AlertBellIcon,
    color: "text-violet-300",
  },
  { key: "task", label: "Tasks", Icon: CheckIcon, color: "text-cyan-300" },
  { key: "event", label: "Events", Icon: CalendarIcon, color: "text-pink-300" },
];

const RECURRING_FILTERS: {
  key: RecurringFilter;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { key: "all", label: "All", Icon: ListIcon },
  { key: "recurring", label: "Repeating", Icon: RotateCcwIcon },
  { key: "one-time", label: "Once", Icon: ZapIcon },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function FilterBar({
  userFilter,
  onUserFilterChange,
  sections,
  activeSection,
  onSectionChange,
  dateRange,
  onDateRangeChange,
  groupMode,
  onGroupModeChange,
  showGroupToggle = false,
  availableCategories,
  categoryFilters,
  onCategoryFiltersChange,
  showCategoryFilter = false,
  typeFilter,
  onTypeFilterChange,
  recurringFilter,
  onRecurringFilterChange,
  showJournalFilters = false,
  isBlurred,
  onToggleBlur,
  isBudgetSection,
  isFetching,
  onRefresh,
}: FilterBarProps) {
  const themeClasses = useThemeClasses();
  const { theme: currentUserTheme } = useTheme();
  const [showFilters, setShowFilters] = useState(false);
  const [catSectionOpen, setCatSectionOpen] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [customStart, setCustomStart] = useState(dateRange.start);
  const [customEnd, setCustomEnd] = useState(dateRange.end);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(() => getDatePresets(), []);

  const themeColor =
    currentUserTheme === "pink"
      ? { me: "#ec4899", partner: "#3b82f6" }
      : { me: "#3b82f6", partner: "#ec4899" };

  const activeDateLabel = useMemo(() => {
    const match = presets.find(
      (p) => p.start === dateRange.start && p.end === dateRange.end,
    );
    return match?.label ?? "Custom";
  }, [presets, dateRange]);

  // Count active non-default filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeDateLabel !== "This Month") count++;
    if (showJournalFilters && typeFilter !== "all") count++;
    if (showJournalFilters && recurringFilter !== "all") count++;
    if (showCategoryFilter && categoryFilters.length > 0) count++;
    return count;
  }, [
    activeDateLabel,
    showJournalFilters,
    typeFilter,
    recurringFilter,
    showCategoryFilter,
    categoryFilters,
  ]);

  // Close filter panel on outside click
  useEffect(() => {
    if (!showFilters) return;
    const handler = (e: MouseEvent) => {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target as Node)
      ) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFilters]);

  return (
    <div
      ref={filterPanelRef}
      className={cn(
        "sticky top-14 z-30",
        "bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md",
        "border-b border-white/5",
      )}
    >
      {/* Row 1: Me / Both / Partner */}
      <div className="flex items-center border-b border-white/5">
        <button
          onClick={() => onUserFilterChange("mine")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            userFilter === "mine"
              ? "text-white"
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
          style={
            userFilter === "mine"
              ? { borderColor: themeColor.me, color: themeColor.me }
              : {}
          }
        >
          <UserIcon className="w-3.5 h-3.5" />
          Me
        </button>
        <button
          onClick={() => onUserFilterChange("all")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            userFilter === "all"
              ? `border-current ${themeClasses.textActive}`
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
        >
          <UsersIcon className="w-3.5 h-3.5" />
          Both
        </button>
        <button
          onClick={() => onUserFilterChange("partner")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            userFilter === "partner"
              ? "text-white"
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
          style={
            userFilter === "partner"
              ? { borderColor: themeColor.partner, color: themeColor.partner }
              : {}
          }
        >
          <HeartIcon className="w-3.5 h-3.5" />
          Partner
        </button>
      </div>

      {/* Row 2: Section tabs + action icons */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        {/* Section tabs */}
        <div className="flex gap-0.5 neo-card rounded-xl p-1 flex-1 min-w-0">
          {sections.map(({ key, label, Icon, variant }, idx) => {
            const isActive = activeSection === key;
            const showDivider =
              idx > 0 &&
              sections[idx - 1]?.variant !== variant &&
              variant === "journal";
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center flex-1",
                  showDivider && "border-l border-white/10 pl-0.5 ml-0.5",
                )}
              >
                <button
                  onClick={() => onSectionChange(key)}
                  className={cn(
                    "w-full flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-0",
                    isActive
                      ? variant === "journal"
                        ? "bg-violet-500/25 text-violet-300 shadow-sm"
                        : "neo-gradient text-white shadow-sm"
                      : `${themeClasses.text} hover:bg-white/5`,
                  )}
                >
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Filter icon */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "relative p-1.5 rounded-lg transition-colors flex-shrink-0",
            showFilters || activeFilterCount > 0
              ? `${themeClasses.bgActive} ${themeClasses.textActive}`
              : `neo-card ${themeClasses.text} hover:bg-white/5`,
          )}
          title="Filters"
        >
          <FilterIcon className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full neo-gradient" />
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className={cn(
            "p-1.5 rounded-lg transition-colors flex-shrink-0",
            isFetching
              ? `${themeClasses.bgActive} ${themeClasses.textActive}`
              : `neo-card ${themeClasses.text} hover:bg-white/5`,
          )}
          title="Refresh data"
        >
          <RefreshIcon
            className={cn("w-4 h-4", isFetching && "animate-spin")}
          />
        </button>

        {/* Eye — budget sections only */}
        {isBudgetSection && (
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(5);
              onToggleBlur();
            }}
            className={cn(
              "p-1.5 rounded-lg transition-colors flex-shrink-0",
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

      {/* Filter Panel */}
      {showFilters && (
        <div className="animate-in slide-in-from-top-2 duration-150 border-t border-white/5 px-3 pb-2.5 pt-1.5 space-y-2">
          {/* Panel header: Reset (left) + Close (right) */}
          <div className="flex items-center justify-between">
            {activeFilterCount > 0 ? (
              <button
                onClick={() => {
                  const now = new Date();
                  const monthStart = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1,
                  );
                  const monthEnd = new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    0,
                  );
                  onDateRangeChange({
                    start: yyyyMmDd(monthStart),
                    end: yyyyMmDd(monthEnd),
                  });
                  if (showCategoryFilter) onCategoryFiltersChange([]);
                  if (showJournalFilters) {
                    onTypeFilterChange("all");
                    onRecurringFilterChange("all");
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                title="Reset all filters"
              >
                <RotateCcwIcon className="w-3 h-3" />
                Reset
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={() => setShowFilters(false)}
              className="p-1 rounded-lg transition-colors text-slate-400 hover:text-slate-200 hover:bg-white/5"
              title="Close filters"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row: Group by + Date Range (inline) */}
          <div className="flex items-center gap-2">
            {showGroupToggle && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/30">
                  Group
                </p>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => onGroupModeChange("time")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      groupMode === "time"
                        ? "bg-violet-500/25 text-violet-300"
                        : `neo-card ${themeClasses.text} hover:bg-white/5`,
                    )}
                    title="Group by time"
                  >
                    <GroupTimeIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onGroupModeChange("category")}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      groupMode === "category"
                        ? "bg-violet-500/25 text-violet-300"
                        : `neo-card ${themeClasses.text} hover:bg-white/5`,
                    )}
                    title="Group by category"
                  >
                    <GroupCatIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Date Range — inline collapsed */}
            <div className="neo-card rounded-xl overflow-hidden flex-1 min-w-0">
              <button
                onClick={() => setDateRangeOpen((v) => !v)}
                className="w-full px-2.5 py-1.5 flex items-center justify-between"
              >
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/30">
                  Date
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      activeDateLabel !== "This Month"
                        ? `${themeClasses.textActive}`
                        : themeClasses.textMuted,
                    )}
                  >
                    {activeDateLabel}
                  </span>
                  {dateRangeOpen ? (
                    <ChevronUpIcon className="w-3 h-3 text-white/20" />
                  ) : (
                    <ChevronDownIcon className="w-3 h-3 text-white/20" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Date Range Expanded Content */}
          {dateRangeOpen && (
            <div className="neo-card rounded-xl overflow-hidden">
              <div className="px-2.5 pb-2.5 pt-2 space-y-2">
                {/* Quick presets in 3-column grid */}
                <div className="grid grid-cols-3 gap-1">
                  {presets.map((preset) => {
                    const isActive =
                      dateRange.start === preset.start &&
                      dateRange.end === preset.end;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          onDateRangeChange({
                            start: preset.start,
                            end: preset.end,
                          });
                          setCustomDateOpen(false);
                          setDateRangeOpen(false);
                        }}
                        className={cn(
                          "px-1.5 py-1 rounded-lg text-[10px] font-medium transition-colors",
                          isActive
                            ? "neo-gradient text-white"
                            : `neo-card ${themeClasses.text} hover:bg-white/5`,
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom date range */}
                <div className="neo-card rounded-xl overflow-hidden">
                  <button
                    onClick={() => setCustomDateOpen((v) => !v)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between"
                  >
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        themeClasses.textMuted,
                      )}
                    >
                      Custom Range
                    </span>
                    {customDateOpen ? (
                      <ChevronUpIcon className="w-3 h-3 text-white/20" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 text-white/20" />
                    )}
                  </button>
                  {customDateOpen && (
                    <div className="px-2.5 pb-2 pt-1.5 border-t border-white/5 space-y-1.5">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] text-white/40 block mb-0.5">
                            Start
                          </label>
                          <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className={cn(
                              "w-full px-2 py-1 rounded-lg text-[10px] bg-white/5 border border-white/10",
                              "text-white placeholder-white/30 focus:outline-none focus:border-white/20",
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[9px] text-white/40 block mb-0.5">
                            End
                          </label>
                          <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className={cn(
                              "w-full px-2 py-1 rounded-lg text-[10px] bg-white/5 border border-white/10",
                              "text-white placeholder-white/30 focus:outline-none focus:border-white/20",
                            )}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (customStart && customEnd) {
                            onDateRangeChange({
                              start: customStart,
                              end: customEnd,
                            });
                            setCustomDateOpen(false);
                            setDateRangeOpen(false);
                          }
                        }}
                        className="w-full px-2 py-1 rounded-lg text-[10px] font-medium neo-gradient text-white transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Categories — collapsible, only when showCategoryFilter */}
          {showCategoryFilter && availableCategories.length > 0 && (
            <div className="neo-card rounded-xl overflow-hidden">
              <button
                onClick={() => setCatSectionOpen((v) => !v)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5"
              >
                <TagIcon className="w-3 h-3 text-white/25 flex-shrink-0" />
                <span
                  className={cn(
                    "text-[10px] font-medium flex-1 text-left",
                    themeClasses.textMuted,
                  )}
                >
                  Categories
                </span>
                {categoryFilters.length > 0 && (
                  <span className="text-[9px] neo-gradient text-white px-1.5 py-0.5 rounded-full font-medium leading-none">
                    {categoryFilters.length}
                  </span>
                )}
                {catSectionOpen ? (
                  <ChevronUpIcon className="w-3 h-3 text-white/20" size={12} />
                ) : (
                  <ChevronDownIcon
                    className="w-3 h-3 text-white/20"
                    size={12}
                  />
                )}
              </button>
              {catSectionOpen && (
                <div className="px-2.5 pb-2.5 border-t border-white/5 pt-1.5 flex flex-wrap gap-1">
                  {availableCategories.map(({ name, color }) => {
                    const isSelected = categoryFilters.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() =>
                          onCategoryFiltersChange(
                            isSelected
                              ? categoryFilters.filter((c) => c !== name)
                              : [...categoryFilters, name],
                          )
                        }
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors"
                        style={
                          isSelected
                            ? {
                                backgroundColor: `${color}20`,
                                color: color,
                                border: `1px solid ${color}45`,
                              }
                            : {
                                backgroundColor: "rgba(255,255,255,0.04)",
                                color: "rgba(255,255,255,0.35)",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: isSelected
                              ? color
                              : "rgba(255,255,255,0.2)",
                          }}
                        />
                        {name}
                      </button>
                    );
                  })}
                  {categoryFilters.length > 0 && (
                    <button
                      onClick={() => onCategoryFiltersChange([])}
                      className="flex items-center px-1.5 py-0.5 rounded-full text-[9px] text-white/30 hover:text-white/50 transition-colors"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Journal filters: Type + Recurrence on same row */}
          {showJournalFilters && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 flex-shrink-0">
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/30">
                  Type
                </p>
                <div className="flex gap-0.5">
                  {TYPE_FILTERS.map(({ key, label, Icon, color }) => (
                    <button
                      key={key}
                      onClick={() => onTypeFilterChange(key)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        typeFilter === key
                          ? "bg-white/10 " + color
                          : `neo-card ${themeClasses.text} hover:bg-white/5`,
                      )}
                      title={label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/30">
                  Repeat
                </p>
                <div className="flex gap-0.5">
                  {RECURRING_FILTERS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      onClick={() => onRecurringFilterChange(key)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        recurringFilter === key
                          ? "bg-violet-500/25 text-violet-300"
                          : `neo-card ${themeClasses.text} hover:bg-white/5`,
                      )}
                      title={label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
