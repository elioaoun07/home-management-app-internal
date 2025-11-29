"use client";

import UserMenuClient from "@/components/auth/UserMenuClient";
import WebBudget from "@/components/web/WebBudget";
import WebDashboard from "@/components/web/WebDashboard";
import { useUser } from "@/contexts/UserContext";
import { useUserPreferences } from "@/features/preferences/useUserPreferences";
import { useDashboardTransactions } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getDefaultDateRange } from "@/lib/utils/date";
import { BarChart3, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type WebTab = "dashboard" | "budget";

// Mock category budgets for now (will be connected to Supabase later)
const DEFAULT_CATEGORY_BUDGETS = [
  {
    id: "food-dining",
    name: "Food & Dining",
    color: "#FF7043",
    budget: 800,
    spent: 0,
  },
  {
    id: "transport",
    name: "Transport",
    color: "#29B6F6",
    budget: 300,
    spent: 0,
  },
  { id: "shopping", name: "Shopping", color: "#AB47BC", budget: 500, spent: 0 },
  {
    id: "bills-utilities",
    name: "Bills & Utilities",
    color: "#FFA726",
    budget: 400,
    spent: 0,
  },
  { id: "health", name: "Health", color: "#66BB6A", budget: 200, spent: 0 },
  {
    id: "entertainment",
    name: "Entertainment",
    color: "#EC407A",
    budget: 300,
    spent: 0,
  },
  { id: "travel", name: "Travel", color: "#42A5F5", budget: 500, spent: 0 },
  {
    id: "home-rent",
    name: "Home & Rent",
    color: "#8D6E63",
    budget: 1500,
    spent: 0,
  },
  {
    id: "education",
    name: "Education",
    color: "#42A5F5",
    budget: 200,
    spent: 0,
  },
  {
    id: "gifts-charity",
    name: "Gifts & Charity",
    color: "#EC407A",
    budget: 150,
    spent: 0,
  },
];

export default function WebViewContainer() {
  const themeClasses = useThemeClasses();
  const userData = useUser(); // Get user data from context (server-side)
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
    isError,
    error,
  } = useDashboardTransactions({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Calculate spent amounts per category from transactions
  const categoryBudgets = useMemo(() => {
    const spentByCategory: Record<string, number> = {};

    transactions.forEach((tx) => {
      const category = tx.category || "Uncategorized";
      spentByCategory[category] = (spentByCategory[category] || 0) + tx.amount;
    });

    return DEFAULT_CATEGORY_BUDGETS.map((cat) => ({
      ...cat,
      spent: spentByCategory[cat.name] || 0,
    }));
  }, [transactions]);

  const handleDateRangeChange = (start: string, end: string) => {
    setDateRange({ start, end });
  };

  const handleBudgetChange = (categoryId: string, newBudget: number) => {
    // TODO: Save to Supabase when schema is ready
    console.log(`Budget changed for ${categoryId}: $${newBudget}`);
  };

  // Loading state
  if (isLoading && transactions.length === 0) {
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
          {/* Logo/Title */}
          <div className="flex items-center gap-3">
            <div
              className={`text-xl font-bold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
            >
              Budget Manager
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
        {/* Dashboard View */}
        <div className={activeTab === "dashboard" ? "block" : "hidden"}>
          <WebDashboard
            transactions={transactions}
            startDate={dateRange.start}
            endDate={dateRange.end}
            currentUserId={currentUserId}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>

        {/* Budget View */}
        <div className={activeTab === "budget" ? "block" : "hidden"}>
          <WebBudget
            categories={categoryBudgets}
            onBudgetChange={handleBudgetChange}
          />
        </div>
      </main>

      {/* Bottom Navigation - Fixed at bottom, outside scroll */}
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
          </div>
        </div>
      </nav>
    </div>
  );
}
