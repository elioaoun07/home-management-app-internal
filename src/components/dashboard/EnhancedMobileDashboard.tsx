"use client";

import CategoryDetailView from "@/components/dashboard/CategoryDetailView";
import SwipeableTransactionItem from "@/components/dashboard/SwipeableTransactionItem";
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  ChevronDownIcon,
  DollarSignIcon,
  FilterIcon,
  ListIcon,
  RefreshIcon,
  StarIcon,
} from "@/components/icons/FuturisticIcons";
import { Card } from "@/components/ui/card";
import { SyncIndicator } from "@/components/ui/SyncIndicator";
import { useTheme } from "@/contexts/ThemeContext";
import { useAccounts } from "@/features/accounts/hooks";
import { useDeleteTransaction } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import {
  calculateIncomeExpenseSummary,
  getExpenseTransactions,
} from "@/lib/utils/incomeExpense";
import { getTransactionDisplayAmount } from "@/lib/utils/splitBill";
import { useQueryClient } from "@tanstack/react-query";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
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
  category_color?: string;
  subcategory_color?: string;
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
  // True if current user is the collaborator on a split transaction
  is_collaborator?: boolean;
  // Split bill fields
  split_requested?: boolean;
  collaborator_id?: string;
  collaborator_amount?: number;
  collaborator_description?: string;
  split_completed_at?: string;
  total_amount?: number;
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
type AccountTypeFilter = "expense" | "income" | "all";
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
  const { data: accounts } = useAccounts();
  const [viewMode, setViewMode] = useState<ViewMode>("widgets");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");
  const [accountTypeFilter, setAccountTypeFilter] =
    useState<AccountTypeFilter>("expense");
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

  // ==================== INCOME VS EXPENSE ====================
  const incomeExpenseSummary = useMemo(() => {
    return calculateIncomeExpenseSummary(transactions, accounts);
  }, [transactions, accounts]);

  // Filtered income/expense summary that respects ownership filter
  const filteredIncomeExpenseSummary = useMemo(() => {
    let filteredTxs = [...transactions];

    // Apply ownership filter
    // For split bills: "mine" includes transactions where user is owner OR collaborator
    // "partner" shows transactions where user is neither owner nor collaborator
    if (ownershipFilter === "mine") {
      filteredTxs = filteredTxs.filter(
        (t) => t.is_owner === true || t.is_collaborator === true
      );
    } else if (ownershipFilter === "partner") {
      // Partner filter should include:
      // 1. Transactions owned by partner (!is_owner)
      // 2. Transactions owned by me but split with partner (is_owner && split_completed_at)
      filteredTxs = filteredTxs.filter(
        (t) =>
          t.is_owner === false ||
          (t.is_owner === true && !!t.split_completed_at)
      );
    }

    // Map transactions to use the correct display amount for the summary calculation
    const mappedTxs = filteredTxs.map((t) => ({
      ...t,
      amount: getTransactionDisplayAmount(t, ownershipFilter),
    }));

    return calculateIncomeExpenseSummary(mappedTxs, accounts);
  }, [transactions, accounts, ownershipFilter]);

  // Filter transactions based on account type FIRST
  const typeFilteredTransactions = useMemo(() => {
    if (accountTypeFilter === "all") return transactions;
    return (
      accountTypeFilter === "expense"
        ? getExpenseTransactions(transactions, accounts)
        : incomeExpenseSummary.incomeTransactions
    ) as Transaction[];
  }, [
    transactions,
    accountTypeFilter,
    accounts,
    incomeExpenseSummary.incomeTransactions,
  ]);
  // ==================== END INCOME VS EXPENSE ====================

  // Filter and sort transactions FIRST (before stats calculation)
  const filteredTransactions = useMemo(() => {
    let filtered = [...typeFilteredTransactions];

    // Ownership filter
    // For split bills: "mine" includes transactions where user is owner OR collaborator
    // "partner" shows transactions where user is neither owner nor collaborator
    if (ownershipFilter === "mine") {
      filtered = filtered.filter(
        (t) => t.is_owner === true || t.is_collaborator === true
      );
    } else if (ownershipFilter === "partner") {
      // Partner filter should include:
      // 1. Transactions owned by partner (!is_owner)
      // 2. Transactions owned by me but split with partner (is_owner && split_completed_at)
      filtered = filtered.filter(
        (t) =>
          t.is_owner === false ||
          (t.is_owner === true && !!t.split_completed_at)
      );
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
    const total = filteredTransactions.reduce(
      (sum, t) => sum + getTransactionDisplayAmount(t, ownershipFilter),
      0
    );
    const defaultColor = themeClasses.defaultAccentColor;
    const byCategory = filteredTransactions.reduce(
      (acc, t) => {
        const cat = t.category || "Uncategorized";
        const displayAmount = getTransactionDisplayAmount(t, ownershipFilter);
        acc[cat] = {
          amount: (acc[cat]?.amount || 0) + displayAmount,
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
    ownershipFilter,
  ]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(transactions.map((t) => t.category).filter(Boolean))
    );
  }, [transactions]);

  const accountNames = useMemo(() => {
    return Array.from(
      new Set(
        typeFilteredTransactions.map((t) => t.account_name).filter(Boolean)
      )
    );
  }, [typeFilteredTransactions]);

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
    setAccountTypeFilter("expense");
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
    // Apply same ownership filter as the main list
    let filtered = transactions.filter((t) => t.category === categoryName);
    if (ownershipFilter === "mine") {
      filtered = filtered.filter(
        (t) => t.is_owner === true || t.is_collaborator === true
      );
    } else if (ownershipFilter === "partner") {
      // Partner filter should include:
      // 1. Transactions owned by partner (!is_owner)
      // 2. Transactions owned by me but split with partner (is_owner && split_completed_at)
      filtered = filtered.filter(
        (t) =>
          t.is_owner === false ||
          (t.is_owner === true && !!t.split_completed_at)
      );
    }
    return filtered;
  };

  if (categoryDetail) {
    const categoryTxs = getCategoryTransactions(categoryDetail);
    const totalAmount = categoryTxs.reduce(
      (sum, t) => sum + getTransactionDisplayAmount(t, ownershipFilter),
      0
    );
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
        ownershipFilter={ownershipFilter}
        onBack={() => setCategoryDetail(null)}
        onTransactionClick={setSelectedTransaction}
      />
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.pageBg} pb-20`}>
      {/* Sticky Header with Ownership Toggle - positioned below app mode toggle */}
      <div
        className={`sticky top-[112px] z-20 ${themeClasses.headerGradient} backdrop-blur-xl`}
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

          {/* Sync Status Indicator */}
          <SyncIndicator compact />
        </div>

        {/* Expandable Filters Panel */}
        {showFilters && (
          <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200 border-t border-white/5">
            {/* Date Quick Filters - Horizontal scroll for mobile */}
            <div className="pt-3">
              <div
                className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted} mb-2 flex items-center justify-between`}
              >
                <span>Date Range</span>
                <span
                  className={`text-[9px] ${themeClasses.textMuted} normal-case tracking-normal`}
                >
                  {format(new Date(startDate), "MMM d")} -{" "}
                  {format(new Date(endDate), "MMM d")}
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {[
                  {
                    label: "Today",
                    getValue: () => {
                      const t = format(new Date(), "yyyy-MM-dd");
                      return { start: t, end: t };
                    },
                  },
                  {
                    label: "Yesterday",
                    getValue: () => {
                      const y = format(subDays(new Date(), 1), "yyyy-MM-dd");
                      return { start: y, end: y };
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
                    label: "Last Week",
                    getValue: () => {
                      const lw = subDays(new Date(), 7);
                      return {
                        start: format(
                          startOfWeek(lw, { weekStartsOn: 1 }),
                          "yyyy-MM-dd"
                        ),
                        end: format(
                          endOfWeek(lw, { weekStartsOn: 1 }),
                          "yyyy-MM-dd"
                        ),
                      };
                    },
                  },
                  {
                    label: "This Month",
                    getValue: () => ({
                      start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
                      end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
                    }),
                  },
                  {
                    label: "Last Month",
                    getValue: () => {
                      const lm = subMonths(new Date(), 1);
                      return {
                        start: format(startOfMonth(lm), "yyyy-MM-dd"),
                        end: format(endOfMonth(lm), "yyyy-MM-dd"),
                      };
                    },
                  },
                  {
                    label: "3 Months",
                    getValue: () => ({
                      start: format(
                        startOfMonth(subMonths(new Date(), 2)),
                        "yyyy-MM-dd"
                      ),
                      end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
                    }),
                  },
                  {
                    label: "This Year",
                    getValue: () => ({
                      start: format(startOfYear(new Date()), "yyyy-MM-dd"),
                      end: format(endOfYear(new Date()), "yyyy-MM-dd"),
                    }),
                  },
                  {
                    label: "Last Year",
                    getValue: () => {
                      const ly = subYears(new Date(), 1);
                      return {
                        start: format(startOfYear(ly), "yyyy-MM-dd"),
                        end: format(endOfYear(ly), "yyyy-MM-dd"),
                      };
                    },
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
                        "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0",
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
            </div>

            {/* Category & Account Filters - Native selects with better styling */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-lg ${themeClasses.bgSurface} neo-border text-white text-xs ${themeClasses.focusBorder} focus:ring-1 ${themeClasses.focusRing} transition-all appearance-none pr-8`}
                  style={{ WebkitAppearance: "none", MozAppearance: "none" }}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat || "unknown"} value={cat || ""}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="flex-1 relative">
                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-lg ${themeClasses.bgSurface} neo-border text-white text-xs ${themeClasses.focusBorder} focus:ring-1 ${themeClasses.focusRing} transition-all appearance-none pr-8`}
                  style={{ WebkitAppearance: "none", MozAppearance: "none" }}
                >
                  <option value="">All Accounts</option>
                  {accountNames.map((acc) => (
                    <option key={acc || "unknown"} value={acc || ""}>
                      {acc}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Sort & Clear Row */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {(["recent", "date", "amount"] as SortField[]).map((field) => (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-medium flex items-center gap-0.5 transition-all",
                      sortField === field
                        ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                        : `${themeClasses.textMuted} hover:bg-white/5`
                    )}
                  >
                    {field === "recent"
                      ? "Recent"
                      : field.charAt(0).toUpperCase() + field.slice(1)}
                    {sortField === field &&
                      (sortOrder === "asc" ? (
                        <ArrowUpRightIcon className="w-2.5 h-2.5" />
                      ) : (
                        <ArrowDownRightIcon className="w-2.5 h-2.5" />
                      ))}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${themeClasses.textMuted}`}>
                  {filteredTransactions.length}/{transactions.length}
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-5">
        {viewMode === "widgets" && (
          <div className="space-y-3">
            {/* Income / Expense / Balance - Animated Cards */}
            <div className="grid grid-cols-3 gap-2">
              {/* Income */}
              <Card className="neo-card p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl spring-bounce shimmer bg-gradient-to-br from-emerald-500/10 to-transparent">
                <div className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-1.5 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                    <ArrowDownRightIcon className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  </div>
                  <p className="text-[9px] text-emerald-300/70 uppercase tracking-wide mb-0.5">
                    Income
                  </p>
                  <p className="text-xl font-bold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                    ${filteredIncomeExpenseSummary.totalIncome.toFixed(0)}
                  </p>
                </div>
              </Card>

              {/* Expense */}
              <Card
                className="neo-card p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl spring-bounce shimmer bg-gradient-to-br from-red-500/10 to-transparent"
                style={{ animationDelay: "50ms" }}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mb-1.5 shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                    <ArrowUpRightIcon className="w-4 h-4 text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                  </div>
                  <p className="text-[9px] text-red-300/70 uppercase tracking-wide mb-0.5">
                    Expense
                  </p>
                  <p className="text-xl font-bold text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                    ${filteredIncomeExpenseSummary.totalExpense.toFixed(0)}
                  </p>
                </div>
              </Card>

              {/* Balance */}
              <Card
                className={cn(
                  "neo-card p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl spring-bounce shimmer bg-gradient-to-br to-transparent",
                  filteredIncomeExpenseSummary.netBalance >= 0
                    ? "from-cyan-500/10"
                    : "from-orange-500/10"
                )}
                style={{ animationDelay: "100ms" }}
              >
                <div className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center mb-1.5",
                      filteredIncomeExpenseSummary.netBalance >= 0
                        ? "bg-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                        : "bg-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.3)]"
                    )}
                  >
                    <DollarSignIcon
                      className={cn(
                        "w-4 h-4",
                        filteredIncomeExpenseSummary.netBalance >= 0
                          ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]"
                          : "text-orange-400 drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]"
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-[9px] uppercase tracking-wide mb-0.5",
                      filteredIncomeExpenseSummary.netBalance >= 0
                        ? "text-cyan-300/70"
                        : "text-orange-300/70"
                    )}
                  >
                    Balance
                  </p>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      filteredIncomeExpenseSummary.netBalance >= 0
                        ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                        : "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                    )}
                  >
                    {filteredIncomeExpenseSummary.netBalance >= 0 ? "+" : ""}$
                    {filteredIncomeExpenseSummary.netBalance.toFixed(0)}
                  </p>
                </div>
              </Card>
            </div>

            {/* Top Category & Daily - Compact animated row */}
            <div className="grid grid-cols-2 gap-2">
              <Card
                className="neo-card p-3 transition-all duration-300 hover:-translate-y-0.5 spring-bounce bg-gradient-to-br from-amber-500/8 to-transparent"
                style={{ animationDelay: "150ms" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <StarIcon className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-[10px] text-amber-300/70 uppercase tracking-wide">
                      Top
                    </span>
                  </div>
                  <span className="text-sm font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent truncate max-w-[80px]">
                    {stats.topCategory?.name || "—"}
                  </span>
                </div>
              </Card>

              <Card
                className="neo-card p-3 transition-all duration-300 hover:-translate-y-0.5 spring-bounce bg-gradient-to-br from-sky-500/8 to-transparent"
                style={{ animationDelay: "200ms" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center">
                      <BarChart3Icon className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <span className="text-[10px] text-sky-300/70 uppercase tracking-wide">
                      Daily
                    </span>
                  </div>
                  <span className="text-lg font-bold bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                    ${stats.dailyAvg.toFixed(0)}
                  </span>
                </div>
              </Card>
            </div>

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
                        $
                        {getTransactionDisplayAmount(
                          tx,
                          ownershipFilter
                        ).toFixed(0)}
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
                    ownershipFilter={ownershipFilter}
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
