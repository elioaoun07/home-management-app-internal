"use client";

import UserMenuClient from "@/components/auth/UserMenuClient";
import WebBudget from "@/components/web/WebBudget";
import WebCatalogue from "@/components/web/WebCatalogue";
import WebDashboard from "@/components/web/WebDashboard";
import WebEvents from "@/components/web/WebEvents";
import WebFuturePurchases from "@/components/web/WebFuturePurchases";
import { useUser } from "@/contexts/UserContext";
import { useUserPreferences } from "@/features/preferences/useUserPreferences";
import { useDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getDefaultDateRange } from "@/lib/utils/date";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Rocket,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Top-level view modes - Budget, Events, or Catalogue
export type WebViewMode = "budget" | "events" | "catalogue";

// Tabs within Budget view
export type WebTab = "dashboard" | "budget" | "goals";

export default function WebViewContainer() {
  const themeClasses = useThemeClasses();
  const userData = useUser(); // Get user data from context (server-side)
  const [viewMode, setViewMode] = useState<WebViewMode>("events");
  const [activeTab, setActiveTab] = useState<WebTab>("dashboard");
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined
  );
  const { data: preferences } = useUserPreferences();

  const defaultRange = useMemo(
    () => getDefaultDateRange(monthStartDay),
    [monthStartDay]
  );

  const [dateRange, setDateRange] = useState(defaultRange);

  // Fetch current user ID from Supabase auth (only need ID for transactions)
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

  // Only show skeleton on initial load, not on refetch/date change
  const showSkeleton = isLoading && transactions.length === 0;

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ start, end });
  };

  // Loading state - only show skeleton on initial load, not date range changes
  if (showSkeleton) {
    return (
      <div className="h-screen flex flex-col">
        <header
          className={`flex-shrink-0 w-full ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
        >
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div
              className={`text-xl font-bold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
            >
              Budget Manager
            </div>
            <UserMenuClient
              name={userData?.name ?? "User"}
              email={userData?.email ?? ""}
              avatarUrl={userData?.avatarUrl}
            />
          </div>
        </header>
        <main className={`flex-1 overflow-y-auto ${themeClasses.pageBg} p-8`}>
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-28 ${themeClasses.surfaceBg} rounded-xl animate-pulse`}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                className={`h-96 ${themeClasses.surfaceBg} rounded-xl animate-pulse`}
              />
              <div
                className={`h-96 ${themeClasses.surfaceBg} rounded-xl animate-pulse`}
              />
            </div>
          </div>
        </main>
        <nav
          className={`flex-shrink-0 w-full bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-xl border-t ${themeClasses.border}`}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center gap-4 px-6 h-16">
              <div
                className={`neo-gradient text-white shadow-lg px-6 py-3 rounded-xl flex items-center gap-3`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm font-semibold">Dashboard</span>
              </div>
              <div
                className={`neo-card ${themeClasses.text} px-6 py-3 rounded-xl flex items-center gap-3`}
              >
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-semibold">Budget</span>
              </div>
              <div
                className={`neo-card ${themeClasses.text} px-6 py-3 rounded-xl flex items-center gap-3`}
              >
                <Rocket className="w-5 h-5" />
                <span className="text-sm font-semibold">Goals</span>
              </div>
            </div>
          </div>
        </nav>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="h-screen flex flex-col">
        <header
          className={`flex-shrink-0 w-full ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
        >
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div
              className={`text-xl font-bold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
            >
              Budget Manager
            </div>
            <UserMenuClient
              name={userData?.name ?? "User"}
              email={userData?.email ?? ""}
              avatarUrl={userData?.avatarUrl}
            />
          </div>
        </header>
        <main
          className={`flex-1 overflow-y-auto ${themeClasses.pageBg} flex items-center justify-center p-4`}
        >
          <div className="neo-card p-8 text-center max-w-md">
            <div className="text-red-400 text-lg mb-4">Failed to load data</div>
            <div className={`${themeClasses.headerText} text-sm mb-4`}>
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          </div>
        </main>
        <nav
          className={`flex-shrink-0 w-full bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-xl border-t ${themeClasses.border}`}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center gap-4 px-6 h-16">
              <div
                className={`neo-gradient text-white shadow-lg px-6 py-3 rounded-xl flex items-center gap-3`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm font-semibold">Dashboard</span>
              </div>
              <div
                className={`neo-card ${themeClasses.text} px-6 py-3 rounded-xl flex items-center gap-3`}
              >
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-semibold">Budget</span>
              </div>
              <div
                className={`neo-card ${themeClasses.text} px-6 py-3 rounded-xl flex items-center gap-3`}
              >
                <Rocket className="w-5 h-5" />
                <span className="text-sm font-semibold">Goals</span>
              </div>
            </div>
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col animate-in fade-in duration-500">
      {/* Web Header with User Menu - Fixed at top */}
      <header
        className={`flex-shrink-0 w-full ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo/Title with View Mode Toggle */}
          <div className="flex items-center gap-6">
            <div
              className={`text-xl font-bold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
            >
              {viewMode === "budget"
                ? "Budget Manager"
                : viewMode === "catalogue"
                  ? "Life Catalogue"
                  : "Events & Reminders"}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-black/20 border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("events")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  viewMode === "events"
                    ? "neo-gradient text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <CalendarDays className="w-4 h-4" />
                Events
              </button>
              <button
                type="button"
                onClick={() => setViewMode("budget")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  viewMode === "budget"
                    ? "neo-gradient text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <Wallet className="w-4 h-4" />
                Budget
              </button>
              <button
                type="button"
                onClick={() => setViewMode("catalogue")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  viewMode === "catalogue"
                    ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <BookOpen className="w-4 h-4" />
                Catalogue
              </button>
            </div>
          </div>

          {/* User Menu - Always show, with loading state */}
          <UserMenuClient
            name={userData?.name ?? "User"}
            email={userData?.email ?? ""}
            avatarUrl={userData?.avatarUrl}
          />
        </div>
      </header>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* Events View */}
        {viewMode === "events" && <WebEvents />}

        {/* Catalogue View */}
        {viewMode === "catalogue" && <WebCatalogue />}

        {/* Budget Views */}
        {viewMode === "budget" && (
          <>
            {/* Dashboard View */}
            <div className={activeTab === "dashboard" ? "block" : "hidden"}>
              <WebDashboard
                transactions={transactions}
                startDate={dateRange.start}
                endDate={dateRange.end}
                currentUserId={currentUserId}
                onDateRangeChange={handleDateRangeChange}
                isRefetching={isFetching && !isLoading}
              />
            </div>

            {/* Budget View */}
            <div className={activeTab === "budget" ? "block" : "hidden"}>
              <WebBudget />
            </div>

            {/* Future Purchases / Goals View */}
            <div className={activeTab === "goals" ? "block" : "hidden"}>
              <WebFuturePurchases />
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation - Only show for Budget mode */}
      {viewMode === "budget" && (
        <nav
          className={`flex-shrink-0 w-full bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-xl border-t ${themeClasses.border}`}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center gap-4 px-6 h-16">
              <button
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setActiveTab("dashboard");
                }}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                  "hover:scale-105 active:scale-95",
                  activeTab === "dashboard"
                    ? "neo-gradient text-white shadow-lg shadow-primary/30"
                    : `neo-card ${themeClasses.text} hover:bg-white/5`
                )}
              >
                <BarChart3
                  className={cn(
                    "w-5 h-5",
                    activeTab === "dashboard" && "drop-shadow-lg"
                  )}
                />
                <span className="text-sm font-semibold">Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setActiveTab("budget");
                }}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                  "hover:scale-105 active:scale-95",
                  activeTab === "budget"
                    ? "neo-gradient text-white shadow-lg shadow-primary/30"
                    : `neo-card ${themeClasses.text} hover:bg-white/5`
                )}
              >
                <Wallet
                  className={cn(
                    "w-5 h-5",
                    activeTab === "budget" && "drop-shadow-lg"
                  )}
                />
                <span className="text-sm font-semibold">Budget</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setActiveTab("goals");
                }}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                  "hover:scale-105 active:scale-95",
                  activeTab === "goals"
                    ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/30"
                    : `neo-card ${themeClasses.text} hover:bg-white/5`
                )}
              >
                <Rocket
                  className={cn(
                    "w-5 h-5",
                    activeTab === "goals" && "drop-shadow-lg"
                  )}
                />
                <span className="text-sm font-semibold">Goals</span>
              </button>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
