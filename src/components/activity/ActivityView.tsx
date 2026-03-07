"use client";

import {
  EyeIcon,
  EyeOffIcon,
  RefreshIcon,
} from "@/components/icons/FuturisticIcons";
import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { yyyyMmDd } from "@/lib/utils/date";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import TransactionListView from "./TransactionListView";
import TransferListView from "./TransferListView";

type ActiveSection = "transactions" | "transfers";

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

export default function ActivityView() {
  const themeClasses = useThemeClasses();
  const { isBlurred, toggleBlur } = usePrivacyBlur();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] =
    useState<ActiveSection>("transactions");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  const presets = useMemo(() => getDatePresets(), []);
  const todayStr = useMemo(() => yyyyMmDd(new Date()), []);
  const [dateRange, setDateRange] = useState({
    start: todayStr,
    end: todayStr,
  });

  // Track if transactions are currently fetching (for refresh indicator)
  const isFetchingTx = useIsFetching({
    queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
  });

  const handleRefresh = () => {
    if (navigator.vibrate) navigator.vibrate(5);
    queryClient.invalidateQueries({
      queryKey: ["transactions", "dashboard", dateRange.start, dateRange.end],
    });
  };

  // Fetch current user ID
  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.id) setCurrentUserId(user.id);
      });
  }, []);

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
        {/* Top row: Segment toggle + Eye */}
        <div className="flex items-center justify-between gap-3 mb-3">
          {/* Segmented Control */}
          <div className="flex gap-1 neo-card rounded-xl p-1 flex-1">
            {(["transactions", "transfers"] as const).map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                  activeSection === section
                    ? "neo-gradient text-white shadow-sm"
                    : `${themeClasses.text} hover:bg-white/5`,
                )}
              >
                {section}
              </button>
            ))}
          </div>

          {/* Eye toggle + Refresh */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              disabled={isFetchingTx > 0}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                `neo-card ${themeClasses.text} hover:bg-white/5`,
                isFetchingTx > 0 && "opacity-60",
              )}
              title="Refresh data"
            >
              <RefreshIcon
                className={cn("w-4 h-4", isFetchingTx > 0 && "animate-spin")}
              />
            </button>

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
          </div>
        </div>

        {/* Date presets row */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {presets.map((preset) => {
            const isActive =
              dateRange.start === preset.start && dateRange.end === preset.end;
            return (
              <button
                key={preset.label}
                onClick={() =>
                  setDateRange({ start: preset.start, end: preset.end })
                }
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0",
                  isActive
                    ? "neo-gradient text-white shadow-sm"
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3">
        {activeSection === "transactions" ? (
          <TransactionListView
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
          />
        ) : (
          <TransferListView
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
}
