"use client";

import CategoryDetailView from "@/components/dashboard/CategoryDetailView";
import SwipeableTransactionItem from "@/components/dashboard/SwipeableTransactionItem";
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  DollarSignIcon,
  FilterIcon,
  ListIcon,
  RefreshIcon,
  StarIcon,
  TrendingUpIcon,
  XIcon,
} from "@/components/icons/FuturisticIcons";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { useDeleteTransaction } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

// SVG Icons for ownership filter
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

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  inserted_at: string;
  account_name?: string;
  category_icon?: string;
  category_color?: string;
  subcategory_color?: string;
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
};

type Props = {
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  currentUserId?: string;
  onDateRangeChange?: (start: string, end: string) => void;
};

type ViewMode = "widgets" | "list";
type SortField = "recent" | "date" | "amount" | "category";
type SortOrder = "asc" | "desc";
type OwnershipFilter = "all" | "mine" | "partner";
type DatePreset = "today" | "week" | "month" | "custom";

// Memoized component for instant rendering
const EnhancedMobileDashboard = memo(function EnhancedMobileDashboard({
  transactions,
  startDate,
  endDate,
  currentUserId,
  onDateRangeChange,
}: Props) {
  const { theme: currentUserTheme } = useTheme();
  const themeClasses = useThemeClasses();
  const [viewMode, setViewMode] = useState<ViewMode>("widgets");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");
  const [sortField, setSortField] = useState<SortField>("recent");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteTransaction();

  // Check if any transaction is pending (optimistic, not yet confirmed)
  const hasPendingTransactions = useMemo(
    () => transactions.some((t) => (t as any)._isPending),
    [transactions]
  );

  // Filter and sort transactions FIRST (before stats calculation)
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Ownership filter
    if (ownershipFilter === "mine") {
      filtered = filtered.filter((t) => t.is_owner === true);
    } else if (ownershipFilter === "partner") {
      filtered = filtered.filter((t) => t.is_owner === false);
    }

    if (filterCategory) {
      filtered = filtered.filter((t) => t.category === filterCategory);
    }

    if (filterAccount) {
      filtered = filtered.filter((t) => t.account_name === filterAccount);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === "recent") {
        // Sort by inserted_at timestamp (most recently added first)
        comparison =
          new Date(a.inserted_at).getTime() - new Date(b.inserted_at).getTime();
      } else if (sortField === "date") {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === "amount") {
        comparison = a.amount - b.amount;
      } else if (sortField === "category") {
        comparison = (a.category || "").localeCompare(b.category || "");
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    transactions,
    filterCategory,
    filterAccount,
    ownershipFilter,
    sortField,
    sortOrder,
  ]);

  // Calculate summary stats from FILTERED transactions
  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const defaultColor = themeClasses.defaultAccentColor;
    const byCategory = filteredTransactions.reduce(
      (acc, t) => {
        const cat = t.category || "Uncategorized";
        acc[cat] = {
          amount: (acc[cat]?.amount || 0) + t.amount,
          color: t.category_color || defaultColor,
        };
        return acc;
      },
      {} as Record<string, { amount: number; color: string }>
    );

    const topCategory = Object.entries(byCategory).sort(
      (a, b) => b[1].amount - a[1].amount
    )[0];

    // Calculate daily average
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyAvg = daysDiff > 0 ? total / daysDiff : 0;

    return {
      total,
      count: filteredTransactions.length,
      dailyAvg,
      topCategory: topCategory
        ? {
            name: topCategory[0],
            amount: topCategory[1].amount,
            color: topCategory[1].color,
          }
        : null,
      byCategory,
    };
  }, [
    filteredTransactions,
    startDate,
    endDate,
    themeClasses.defaultAccentColor,
  ]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(transactions.map((t) => t.category).filter(Boolean))
    );
  }, [transactions]);

  const accounts = useMemo(() => {
    return Array.from(
      new Set(transactions.map((t) => t.account_name).filter(Boolean))
    );
  }, [transactions]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const clearFilters = () => {
    setFilterCategory("");
    setFilterAccount("");
    setOwnershipFilter("all");
  };

  const hasActiveFilters =
    filterCategory || filterAccount || ownershipFilter !== "all";

  const handleDelete = (id: string) => {
    // Use mutate (not mutateAsync) for instant optimistic UI
    // The mutation hook handles cache updates automatically
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Transaction deleted");
      },
      onError: () => {
        toast.error("Failed to delete transaction");
      },
    });
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: ["transactions", "dashboard", startDate, endDate],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({ queryKey: ["account-balance"] }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setSelectedTransaction(tx);
  };

  const handleCategoryClick = (categoryName: string) => {
    setCategoryDetail(categoryName);
  };

  const getCategoryTransactions = (categoryName: string) => {
    return transactions.filter((t) => t.category === categoryName);
  };

  if (categoryDetail) {
    const categoryTxs = getCategoryTransactions(categoryDetail);
    const totalAmount = categoryTxs.reduce((sum, t) => sum + t.amount, 0);
    // Get category color from the first transaction with this category
    const categoryColor = categoryTxs.find(
      (t) => t.category_color
    )?.category_color;

    return (
      <CategoryDetailView
        category={categoryDetail}
        categoryColor={categoryColor}
        transactions={categoryTxs}
        totalAmount={totalAmount}
        onBack={() => setCategoryDetail(null)}
        onTransactionClick={setSelectedTransaction}
      />
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.pageBg} pb-20`}>
      {/* Sticky Header with Ownership Toggle */}
      <div
        className={`sticky top-14 z-20 ${themeClasses.headerGradient} backdrop-blur-xl`}
      >
        {/* Ownership Filter - Subheader */}
        <div className="flex items-center justify-center border-b border-white/5">
          <button
            onClick={() => setOwnershipFilter("mine")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2",
              ownershipFilter === "mine"
                ? currentUserTheme === "pink"
                  ? "border-pink-500 text-pink-400"
                  : "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            )}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Me
          </button>
          <button
            onClick={() => setOwnershipFilter("all")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2",
              ownershipFilter === "all"
                ? `border-current ${themeClasses.textActive}`
                : "border-transparent text-slate-400 hover:text-slate-300"
            )}
          >
            <UsersIcon className="w-3.5 h-3.5" />
            Both
          </button>
          <button
            onClick={() => setOwnershipFilter("partner")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2",
              ownershipFilter === "partner"
                ? currentUserTheme === "pink"
                  ? "border-blue-500 text-blue-400"
                  : "border-pink-500 text-pink-400"
                : "border-transparent text-slate-400 hover:text-slate-300"
            )}
          >
            <HeartIcon className="w-3.5 h-3.5" />
            Partner
          </button>
        </div>

        {/* View Toggle & Filters Row */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg neo-card">
            <button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(5);
                setViewMode("widgets");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "widgets"
                  ? "neo-gradient text-white shadow-sm"
                  : `${themeClasses.text} hover:bg-white/5`
              )}
            >
              <BarChart3Icon className="w-3.5 h-3.5 inline-block mr-1" />
              Overview
            </button>
            <button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(5);
                setViewMode("list");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "list"
                  ? "neo-gradient text-white shadow-sm"
                  : `${themeClasses.text} hover:bg-white/5`
              )}
            >
              <ListIcon className="w-3.5 h-3.5 inline-block mr-1" />
              List
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              showFilters || hasActiveFilters
                ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                : `neo-card ${themeClasses.text} hover:bg-white/5`
            )}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            Filter
            {hasActiveFilters && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${themeClasses.bgActive.replace("/20", "")}`}
              />
            )}
          </button>
        </div>

        {/* Expandable Filters Panel */}
        {showFilters && (
          <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200 border-t border-white/5">
            {/* Date Quick Filters */}
            <div className="pt-3">
              <div
                className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted} mb-2`}
              >
                Date Range
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {[
                  {
                    label: "Today",
                    getValue: () => {
                      const today = format(new Date(), "yyyy-MM-dd");
                      return { start: today, end: today };
                    },
                  },
                  {
                    label: "This Week",
                    getValue: () => ({
                      start: format(
                        startOfWeek(new Date(), { weekStartsOn: 1 }),
                        "yyyy-MM-dd"
                      ),
                      end: format(
                        endOfWeek(new Date(), { weekStartsOn: 1 }),
                        "yyyy-MM-dd"
                      ),
                    }),
                  },
                  {
                    label: "This Month",
                    getValue: () => ({
                      start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
                      end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
                    }),
                  },
                  {
                    label: "Last 7 Days",
                    getValue: () => ({
                      start: format(subDays(new Date(), 7), "yyyy-MM-dd"),
                      end: format(new Date(), "yyyy-MM-dd"),
                    }),
                  },
                  {
                    label: "Last 30 Days",
                    getValue: () => ({
                      start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
                      end: format(new Date(), "yyyy-MM-dd"),
                    }),
                  },
                ].map((preset) => {
                  const range = preset.getValue();
                  const isActive =
                    startDate === range.start && endDate === range.end;
                  return (
                    <button
                      key={preset.label}
                      onClick={() =>
                        onDateRangeChange?.(range.start, range.end)
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                        isActive
                          ? `neo-gradient text-white shadow-sm`
                          : `neo-card ${themeClasses.text} hover:bg-white/5`
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className={`text-[10px] ${themeClasses.textMuted} mt-2`}>
                <CalendarIcon className="w-3 h-3 inline mr-1" />
                {format(new Date(startDate), "MMM d")} -{" "}
                {format(new Date(endDate), "MMM d, yyyy")}
              </div>
            </div>

            {/* Category & Account Filters */}
            <div>
              <div
                className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted} mb-2`}
              >
                Filters
              </div>
              <div className="flex gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg ${themeClasses.bgSurface} neo-border text-white text-xs ${themeClasses.focusBorder} focus:ring-1 ${themeClasses.focusRing} transition-all appearance-none`}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat || "unknown"} value={cat || ""}>
                      {cat}
                    </option>
                  ))}
                </select>
                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg ${themeClasses.bgSurface} neo-border text-white text-xs ${themeClasses.focusBorder} focus:ring-1 ${themeClasses.focusRing} transition-all appearance-none`}
                >
                  <option value="">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc || "unknown"} value={acc || ""}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sort Options */}
            <div>
              <div
                className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted} mb-2`}
              >
                Sort By
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(["recent", "date", "amount", "category"] as SortField[]).map(
                  (field) => (
                    <button
                      key={field}
                      onClick={() => toggleSort(field)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all",
                        sortField === field
                          ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                          : `neo-card ${themeClasses.text} hover:bg-white/5`
                      )}
                    >
                      {field === "recent"
                        ? "Recent"
                        : field.charAt(0).toUpperCase() + field.slice(1)}
                      {sortField === field &&
                        (sortOrder === "asc" ? (
                          <ArrowUpRightIcon className="w-3 h-3" />
                        ) : (
                          <ArrowDownRightIcon className="w-3 h-3" />
                        ))}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Results & Clear */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className={`text-xs ${themeClasses.textMuted}`}>
                {filteredTransactions.length} of {transactions.length}{" "}
                transactions
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <XIcon className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-15">
        {viewMode === "widgets" && (
          <div className="space-y-3">
            {/* Compact Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="neo-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl spring-bounce shimmer bg-gradient-to-br from-emerald-500/10 to-transparent">
                <div className="flex flex-col items-center justify-center text-center">
                  <DollarSignIcon className="w-6 h-6 text-emerald-400/80 mb-2 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]" />
                  <p className="text-[10px] text-emerald-300/70 mb-1 font-medium uppercase tracking-wide">
                    Total
                  </p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-emerald-400 via-emerald-300 to-teal bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                    ${stats.total.toFixed(0)}
                  </p>
                </div>
              </Card>

              <Card
                className="neo-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl spring-bounce shimmer bg-gradient-to-br from-violet-500/10 to-transparent"
                style={{ animationDelay: "100ms" }}
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <TrendingUpIcon className="w-6 h-6 text-violet-400/80 mb-2 drop-shadow-[0_0_12px_rgba(167,139,250,0.5)]" />
                  <p className="text-[10px] text-violet-300/70 mb-1 font-medium uppercase tracking-wide">
                    Count
                  </p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-violet-400 via-purple-300 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(167,139,250,0.3)]">
                    {stats.count}
                  </p>
                </div>
              </Card>

              <Card
                className="neo-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl spring-bounce shimmer bg-gradient-to-br from-sky-500/10 to-transparent"
                style={{ animationDelay: "200ms" }}
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <BarChart3Icon className="w-6 h-6 text-sky-400/80 mb-2 drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]" />
                  <p className="text-[10px] text-sky-300/70 mb-1 font-medium uppercase tracking-wide">
                    Daily
                  </p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-sky-400 via-cyan-300 to-blue-300 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(56,189,248,0.3)] truncate">
                    ${stats.dailyAvg.toFixed(0)}
                  </p>
                </div>
              </Card>
            </div>

            {/* Top Category - More visual */}
            {stats.topCategory && (
              <Card
                className="neo-card p-3 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent hover:from-amber-500/20 hover:via-orange-500/15 transition-all duration-300 hover:-translate-y-1 shadow-[0_0_20px_rgba(251,191,36,0.15)] hover:shadow-[0_0_25px_rgba(251,191,36,0.25)] spring-bounce"
                style={{ animationDelay: "300ms" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <StarIcon className="w-6 h-6 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-amber-300/80 font-medium">
                        Top Spend
                      </p>
                      <p className="text-sm font-semibold bg-gradient-to-r from-amber-200 to-amber-100 bg-clip-text text-transparent truncate">
                        {stats.topCategory.name}
                      </p>
                    </div>
                  </div>
                  <p className="text-xl font-bold bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.4)] ml-2">
                    ${stats.topCategory.amount.toFixed(0)}
                  </p>
                </div>
              </Card>
            )}

            {/* Category Breakdown - Clickable with progress bars */}
            <Card className="neo-card p-3 bg-gradient-to-br from-slate-500/5 to-transparent">
              <div className="flex items-center justify-between mb-2">
                <h3
                  className={`text-sm font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
                >
                  Categories
                </h3>
                <span className="text-xs text-slate-400/80 font-medium">
                  {Object.keys(stats.byCategory).length}
                </span>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.byCategory)
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .slice(0, 6)
                  .map(([cat, data]) => {
                    const percentage = (data.amount / stats.total) * 100;
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          if (navigator.vibrate) navigator.vibrate(5);
                          handleCategoryClick(cat);
                        }}
                        className="w-full group hover:-translate-y-0.5 transition-transform duration-200 py-1"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="text-xs truncate flex-1 text-left group-hover:brightness-125 transition-all font-medium"
                            style={{ color: data.color }}
                          >
                            {cat}
                          </span>
                          <span className="text-xs font-semibold bg-gradient-to-r from-emerald-400 to-teal bg-clip-text text-transparent ml-2">
                            ${data.amount.toFixed(0)}
                          </span>
                        </div>
                        <div
                          className={`h-2 ${themeClasses.surfaceBgMuted} rounded-full overflow-hidden shadow-inner`}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300 group-hover:brightness-110"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: data.color,
                              boxShadow: `0 0 12px ${data.color}40`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </Card>

            {/* Recent Transactions Preview - Compact */}
            <Card
              className={`neo-card p-3 bg-gradient-to-br ${themeClasses.cardGradient}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
                  >
                    Recent
                  </h3>
                  <span
                    className={`text-[10px] ${themeClasses.textFaint} font-normal`}
                  >
                    Last added
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing || hasPendingTransactions}
                    aria-label="Refresh recent transactions"
                    className={cn(
                      `p-1 rounded-full ${themeClasses.text} ${themeClasses.bgHover} transition-all`,
                      (isRefreshing || hasPendingTransactions) && "opacity-60",
                      "disabled:cursor-not-allowed"
                    )}
                  >
                    <RefreshIcon
                      className={cn(
                        `w-4 h-4 ${themeClasses.glow}`,
                        isRefreshing && "animate-spin"
                      )}
                    />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setViewMode("list");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`text-xs ${themeClasses.text} ${themeClasses.textHover} transition-colors`}
                >
                  View all →
                </button>
              </div>
              <div className="space-y-1.5">
                {filteredTransactions.slice(0, 5).map((tx) => {
                  // Partner transactions use opposite theme color
                  const isPartnerTransaction = tx.is_owner === false;
                  const iconColorClass = isPartnerTransaction
                    ? themeClasses.isPink
                      ? "text-cyan-400/60" // Partner in pink theme = cyan
                      : "text-pink-400/60" // Partner in blue theme = pink
                    : themeClasses.textFaint;
                  const iconGlowClass = isPartnerTransaction
                    ? themeClasses.isPink
                      ? "drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" // Cyan glow
                      : "drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]" // Pink glow
                    : themeClasses.glow;

                  return (
                    <button
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg ${themeClasses.bgSurface} ${themeClasses.bgHover} shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset] ${themeClasses.borderHover} transition-all`}
                    >
                      {(() => {
                        const IconComponent = getCategoryIcon(
                          tx.category || undefined
                        );
                        return (
                          <IconComponent
                            className={`w-5 h-5 ${iconColorClass} ${iconGlowClass}`}
                          />
                        );
                      })()}
                      <div className="flex-1 min-w-0 text-left">
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: tx.category_color || "#e2e8f0" }}
                        >
                          {tx.category || "Uncategorized"}
                        </p>
                        <p className="text-[10px] text-slate-400/70">
                          {format(new Date(tx.date), "MMM d")}
                        </p>
                      </div>
                      {/* Pending sync indicator */}
                      {(tx as any)._isPending && (
                        <span title="Syncing...">
                          <svg
                            className="w-3.5 h-3.5 text-amber-400 animate-spin flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        </span>
                      )}
                      <p
                        className={cn(
                          `text-sm font-bold bg-gradient-to-br ${themeClasses.titleGradient} bg-clip-text text-transparent`,
                          (tx as any)._isPending && "opacity-70"
                        )}
                      >
                        ${tx.amount.toFixed(0)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {viewMode === "list" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3
                className={`text-sm font-semibold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
              >
                Transactions
              </h3>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || hasPendingTransactions}
                aria-label="Refresh transaction list"
                className={cn(
                  `p-1 rounded-full ${themeClasses.text} ${themeClasses.textHover} ${themeClasses.bgHover} transition-all`,
                  (isRefreshing || hasPendingTransactions) && "opacity-60",
                  "disabled:cursor-not-allowed"
                )}
              >
                <RefreshIcon
                  className={cn(
                    `w-4 h-4 ${themeClasses.glow}`,
                    isRefreshing && "animate-spin"
                  )}
                />
              </button>
            </div>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📭</div>
                <p className={`${themeClasses.textMuted} mb-4`}>
                  No transactions found
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 rounded-lg neo-gradient text-white text-sm"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={`text-xs ${themeClasses.textFaint} px-1 mb-2`}>
                  💡 Swipe right to edit • Swipe left to delete
                </div>
                {filteredTransactions.map((tx) => (
                  <SwipeableTransactionItem
                    key={tx.id}
                    transaction={tx}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClick={setSelectedTransaction}
                    currentUserId={currentUserId}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onSave={() => {
            // Mutation hook already invalidates queries - just clear selection
            setSelectedTransaction(null);
          }}
          onDelete={() => {
            // Mutation hook already invalidates queries - just clear selection
            setSelectedTransaction(null);
          }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
});

export default EnhancedMobileDashboard;
