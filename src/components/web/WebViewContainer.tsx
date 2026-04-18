"use client";

import UserMenuClient from "@/components/auth/UserMenuClient";
import WebBudget from "@/components/web/WebBudget";
import WebCatalogue from "@/components/web/WebCatalogue";
import WebDashboard from "@/components/web/WebDashboard";
import WebEvents from "@/components/web/WebEvents";
import WebFuturePurchases from "@/components/web/WebFuturePurchases";
import WebLandingPage from "@/components/web/WebLandingPage";
import WebMealPlanner from "@/components/web/WebMealPlanner";
import WebRecipes from "@/components/web/WebRecipes";
import { ERAMark, type ERAModuleKey } from "@/components/shared/ERAMark";
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
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

// Top-level view modes - Budget, Events, Catalogue, or Recipes
export type WebViewMode = "budget" | "events" | "catalogue" | "recipes";

type ViewConfig = {
  module: ERAModuleKey;
  title: string;
  role: string;
  gradient: string;    // title text gradient
  activeClass: string; // active tab button class
};

const VIEW_CONFIG: Record<WebViewMode, ViewConfig> = {
  events:    { module: "schedule",  title: "Events & Reminders", role: "Schedule Hub",  gradient: "from-violet-400 to-purple-400",  activeClass: "neo-gradient" },
  budget:    { module: "financial", title: "Budget Manager",     role: "Financial",     gradient: "from-cyan-400 to-teal-400",      activeClass: "neo-gradient" },
  catalogue: { module: "memory",    title: "Life Catalogue",     role: "Archive",       gradient: "from-blue-400 to-indigo-400",    activeClass: "bg-gradient-to-r from-violet-600 to-cyan-600" },
  recipes:   { module: "recipe",    title: "Recipes & Meals",    role: "Culinary",      gradient: "from-orange-400 to-amber-400",   activeClass: "bg-gradient-to-r from-emerald-600 to-teal-600" },
};

const NAV_ITEMS: Array<{ mode: WebViewMode; label: string; eraModule: ERAModuleKey }> = [
  { mode: "events",    label: "Events",    eraModule: "schedule"  },
  { mode: "budget",    label: "Budget",    eraModule: "financial" },
  { mode: "catalogue", label: "Catalogue", eraModule: "memory"    },
  { mode: "recipes",   label: "Recipes",   eraModule: "recipe"    },
];

// Tabs within Budget view
export type WebTab = "dashboard" | "budget" | "goals";

// Tabs within Recipes view
export type RecipesTab = "recipes" | "planner";

export default function WebViewContainer() {
  const themeClasses = useThemeClasses();
  const userData = useUser();
  const [showLanding, setShowLanding] = useState(true);
  const [viewMode, setViewMode] = useState<WebViewMode>("events");
  const [activeTab, setActiveTab] = useState<WebTab>("dashboard");
  const [recipesTab, setRecipesTab] = useState<RecipesTab>("recipes");
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined,
  );
  const { data: preferences } = useUserPreferences();

  const defaultRange = useMemo(
    () => getDefaultDateRange(monthStartDay),
    [monthStartDay],
  );

  const [dateRange, setDateRange] = useState(defaultRange);

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

  const handleLandingNav = (mode: WebViewMode) => {
    setViewMode(mode);
    setShowLanding(false);
  };

  const showSkeleton = isLoading && transactions.length === 0;

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ start, end });
  };

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      {/* Dashboard — always rendered underneath the landing overlay */}
      <header
        className={`flex-shrink-0 w-full ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Left: ERA Mark + Title — key re-mounts on viewMode change for entrance animation */}
          <div className="flex items-center gap-3">
            <motion.div
              key={viewMode}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <ERAMark module={VIEW_CONFIG[viewMode].module} size={44} />
            </motion.div>
            <div className="flex flex-col leading-tight">
              <motion.span
                key={`title-${viewMode}`}
                className={`text-[17px] font-bold leading-tight bg-gradient-to-r ${VIEW_CONFIG[viewMode].gradient} bg-clip-text text-transparent`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
              >
                {VIEW_CONFIG[viewMode].title}
              </motion.span>
              <span className="text-[11px] text-white/40 leading-tight">
                {VIEW_CONFIG[viewMode].role}
              </span>
            </div>
          </div>

          {/* Center: View Mode Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-black/20 border border-white/10">
            {NAV_ITEMS.map(({ mode, label, eraModule }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  viewMode === mode
                    ? `${VIEW_CONFIG[mode].activeClass} text-white shadow-lg`
                    : "text-white/60 hover:text-white hover:bg-white/10",
                )}
              >
                <div
                  className={cn(
                    "transition-opacity duration-300",
                    viewMode === mode ? "opacity-100" : "opacity-35",
                  )}
                >
                  <ERAMark module={eraModule} size={22} />
                </div>
                {label}
              </button>
            ))}
          </div>

          {/* Right: Avatar */}
          <div className="flex items-center justify-end">
            <UserMenuClient
              name={userData?.name ?? "User"}
              email={userData?.email ?? ""}
              avatarUrl={userData?.avatarUrl}
            />
          </div>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto">
        {showSkeleton ? (
          <div className={`p-8 ${themeClasses.pageBg} h-full`}>
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
          </div>
        ) : isError ? (
          <div
            className={`flex items-center justify-center h-full ${themeClasses.pageBg} p-4`}
          >
            <div className="neo-card p-8 text-center max-w-md">
              <div className="text-red-400 text-lg mb-4">Failed to load data</div>
              <div className={`${themeClasses.headerText} text-sm`}>
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            </div>
          </div>
        ) : (
          <>
            {viewMode === "events" && <WebEvents />}
            {viewMode === "catalogue" && <WebCatalogue />}
            {viewMode === "recipes" && (
              <>
                <div className={recipesTab === "recipes" ? "block" : "hidden"}>
                  <WebRecipes />
                </div>
                <div className={recipesTab === "planner" ? "block" : "hidden"}>
                  <WebMealPlanner />
                </div>
              </>
            )}
            {viewMode === "budget" && (
              <>
                <div className={activeTab === "dashboard" ? "block" : "hidden"}>
                  <WebDashboard
                    transactions={transactions}
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    currentUserId={currentUserId}
                    onDateRangeChange={handleDateRangeChange}
                    isRefetching={isFetching && !isLoading}
                    monthStartDay={monthStartDay}
                  />
                </div>
                <div className={activeTab === "budget" ? "block" : "hidden"}>
                  <WebBudget />
                </div>
                <div className={activeTab === "goals" ? "block" : "hidden"}>
                  <WebFuturePurchases />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation - Recipes mode */}
      {viewMode === "recipes" && (
        <nav
          className={`flex-shrink-0 w-full bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-xl border-t ${themeClasses.border}`}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center gap-4 px-6 h-16">
              <button
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setRecipesTab("recipes");
                }}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                  "hover:scale-105 active:scale-95",
                  recipesTab === "recipes"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
              >
                <BookOpen
                  className={cn(
                    "w-5 h-5",
                    recipesTab === "recipes" && "drop-shadow-lg",
                  )}
                />
                <span className="text-sm font-semibold">Recipes</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  setRecipesTab("planner");
                }}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                  "hover:scale-105 active:scale-95",
                  recipesTab === "planner"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
              >
                <CalendarDays
                  className={cn(
                    "w-5 h-5",
                    recipesTab === "planner" && "drop-shadow-lg",
                  )}
                />
                <span className="text-sm font-semibold">Meal Planner</span>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Bottom Navigation - Budget mode */}
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
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
              >
                <BarChart3
                  className={cn(
                    "w-5 h-5",
                    activeTab === "dashboard" && "drop-shadow-lg",
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
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
              >
                <Wallet
                  className={cn(
                    "w-5 h-5",
                    activeTab === "budget" && "drop-shadow-lg",
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
                    : `neo-card ${themeClasses.text} hover:bg-white/5`,
                )}
              >
                <Rocket
                  className={cn(
                    "w-5 h-5",
                    activeTab === "goals" && "drop-shadow-lg",
                  )}
                />
                <span className="text-sm font-semibold">Goals</span>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Landing page overlay — at the moment of unmount, the landing is already
          solid black (its void disk covers the viewport), so a short crossfade is
          enough to emerge into the dashboard without any flash or fade-out feel. */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            className="absolute inset-0 z-50"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <WebLandingPage onNavigate={handleLandingNav} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
