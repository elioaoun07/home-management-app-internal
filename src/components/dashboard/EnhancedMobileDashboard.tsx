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
import { useDeleteTransaction } from "@/features/transactions/useDashboardTransactions";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";

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
  user_theme?: string;
  user_id?: string;
  is_owner?: boolean;
};

type Props = {
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  currentUserId?: string;
};

type ViewMode = "widgets" | "list";
type SortField = "recent" | "date" | "amount" | "category";
type SortOrder = "asc" | "desc";

// Memoized component for instant rendering
const EnhancedMobileDashboard = memo(function EnhancedMobileDashboard({
  transactions,
  startDate,
  endDate,
  currentUserId,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("widgets");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("");
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

  // Calculate summary stats with daily average
  const stats = useMemo(() => {
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const byCategory = transactions.reduce(
      (acc, t) => {
        const cat = t.category || "Uncategorized";
        acc[cat] = (acc[cat] || 0) + t.amount;
        return acc;
      },
      {} as Record<string, number>
    );

    const topCategory = Object.entries(byCategory).sort(
      (a, b) => b[1] - a[1]
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
      count: transactions.length,
      dailyAvg,
      topCategory: topCategory
        ? { name: topCategory[0], amount: topCategory[1] }
        : null,
      byCategory,
    };
  }, [transactions, startDate, endDate]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

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
  }, [transactions, filterCategory, filterAccount, sortField, sortOrder]);

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
  };

  const hasActiveFilters = filterCategory || filterAccount;

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Transaction deleted");
    } catch (error) {
      toast.error("Failed to delete transaction");
    }
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

    return (
      <CategoryDetailView
        category={categoryDetail}
        transactions={categoryTxs}
        totalAmount={totalAmount}
        onBack={() => setCategoryDetail(null)}
        onTransactionClick={setSelectedTransaction}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] pb-20">
      {/* View Mode Toggle */}
      <div className="sticky top-14 z-20 bg-gradient-to-b from-[#1a2942] to-[#0f1d2e] px-3 py-3 pb-4 shimmer backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(5);
              setViewMode("widgets");
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:-translate-y-0.5",
              viewMode === "widgets"
                ? "neo-gradient text-white shadow-lg spring-bounce"
                : "neo-card text-[#38bdf8] hover:bg-[#3b82f6]/10 hover:shadow-md"
            )}
          >
            <BarChart3Icon className="w-4 h-4 inline-block mr-1.5 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
            Overview
          </button>
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(5);
              setViewMode("list");
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:-translate-y-0.5",
              viewMode === "list"
                ? "neo-gradient text-white shadow-lg spring-bounce"
                : "neo-card text-[#38bdf8] hover:bg-[#3b82f6]/10 hover:shadow-md"
            )}
          >
            <ListIcon className="w-4 h-4 inline-block mr-1.5 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]" />
            List
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "ml-auto p-2 rounded-lg neo-card hover:bg-[#3b82f6]/10 relative transition-all",
              hasActiveFilters && "ring-2 ring-[#06b6d4]/40",
              showFilters && "bg-[#3b82f6]/20"
            )}
          >
            <FilterIcon className="w-5 h-5 text-[#38bdf8] drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#06b6d4] rounded-full animate-pulse" />
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1a2942]/80 neo-border text-white text-sm focus:border-[#06b6d4] focus:ring-2 focus:ring-[#06b6d4]/20 transition-all"
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
                className="flex-1 px-3 py-2 rounded-lg bg-[#0a1628]/50 shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset] text-white text-sm focus:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)] transition-all"
              >
                <option value="">All Accounts</option>
                {accounts.map((acc) => (
                  <option key={acc || "unknown"} value={acc || ""}>
                    {acc}
                  </option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="p-2 rounded-lg neo-card hover:bg-red-500/10 transition-all"
                >
                  <XIcon className="w-4 h-4 text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]" />
                </button>
              )}
            </div>

            {/* Sort options */}
            <div className="flex gap-2 text-xs">
              {(["recent", "date", "amount", "category"] as SortField[]).map(
                (field) => (
                  <button
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg capitalize flex items-center gap-1 transition-all",
                      sortField === field
                        ? "bg-[#06b6d4]/20 text-[#06b6d4] neo-glow-sm"
                        : "neo-card text-[#38bdf8] hover:bg-[#3b82f6]/10"
                    )}
                  >
                    {field === "recent" ? "Last Added" : field}
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

            {/* Results count */}
            <div className="text-xs text-[#38bdf8]/70 text-center py-1">
              {filteredTransactions.length} of {transactions.length}
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
                <h3 className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Categories
                </h3>
                <span className="text-xs text-slate-400/80 font-medium">
                  {Object.keys(stats.byCategory).length}
                </span>
              </div>
              <div className="space-y-3">
                {Object.entries(stats.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([cat, amt]) => {
                    const percentage = (amt / stats.total) * 100;
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
                          <span className="text-xs text-slate-200 truncate flex-1 text-left group-hover:text-white transition-colors font-medium">
                            {cat}
                          </span>
                          <span className="text-xs font-semibold bg-gradient-to-r from-emerald-400 to-teal bg-clip-text text-transparent ml-2">
                            ${amt.toFixed(0)}
                          </span>
                        </div>
                        <div className="h-2 bg-[#1a2942]/60 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-teal rounded-full transition-all duration-300 group-hover:shadow-[0_0_12px_rgba(59,130,246,0.6)] group-hover:from-blue-400 group-hover:via-cyan-400 group-hover:to-teal"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </Card>

            {/* Recent Transactions Preview - Compact */}
            <Card className="neo-card p-3 bg-gradient-to-br from-indigo-500/5 to-transparent">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    Recent
                  </h3>
                  <span className="text-[10px] text-indigo-300/60 font-normal">
                    Last added
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    aria-label="Refresh recent transactions"
                    className={cn(
                      "p-1 rounded-full text-[#38bdf8] hover:text-[#06b6d4] hover:bg-[#3b82f6]/10 transition-all",
                      isRefreshing && "opacity-60",
                      "disabled:cursor-not-allowed"
                    )}
                  >
                    <RefreshIcon
                      className={cn(
                        "w-4 h-4 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]",
                        isRefreshing && "animate-spin"
                      )}
                    />
                  </button>
                </div>
                <button
                  onClick={() => setViewMode("list")}
                  className="text-xs text-[#38bdf8] hover:text-[#06b6d4] transition-colors"
                >
                  View all →
                </button>
              </div>
              <div className="space-y-1.5">
                {filteredTransactions.slice(0, 5).map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTransaction(tx)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-[#0a1628]/30 hover:bg-[#0f1d2e] shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_15px_rgba(6,182,212,0.2)] transition-all"
                  >
                    {(() => {
                      const IconComponent = getCategoryIcon(
                        tx.category || undefined
                      );
                      return (
                        <IconComponent className="w-5 h-5 text-[#06b6d4]/60 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                      );
                    })()}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-medium text-slate-100 truncate">
                        {tx.category}
                      </p>
                      <p className="text-[10px] text-slate-400/70">
                        {format(new Date(tx.date), "MMM d")}
                      </p>
                    </div>
                    <p className="text-sm font-bold bg-gradient-to-br from-emerald-400 to-teal bg-clip-text text-transparent">
                      ${tx.amount.toFixed(0)}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {viewMode === "list" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Transactions
              </h3>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label="Refresh transaction list"
                className={cn(
                  "p-1 rounded-full text-[#38bdf8] hover:text-[#06b6d4] hover:bg-[#3b82f6]/10 transition-all",
                  isRefreshing && "opacity-60",
                  "disabled:cursor-not-allowed"
                )}
              >
                <RefreshIcon
                  className={cn(
                    "w-4 h-4 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]",
                    isRefreshing && "animate-spin"
                  )}
                />
              </button>
            </div>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-[#38bdf8]/70 mb-4">No transactions found</p>
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
                <div className="text-xs text-[#38bdf8]/60 px-1 mb-2">
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
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            queryClient.invalidateQueries({ queryKey: ["account-balance"] });
          }}
          onDelete={() => {
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            queryClient.invalidateQueries({ queryKey: ["account-balance"] });
          }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
});

export default EnhancedMobileDashboard;
