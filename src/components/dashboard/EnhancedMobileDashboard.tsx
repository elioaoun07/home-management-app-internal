"use client";

import CategoryDetailView from "@/components/dashboard/CategoryDetailView";
import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  DollarSign,
  Edit2,
  Filter,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  account_name?: string;
  category_icon?: string;
};

type Props = {
  transactions: Transaction[];
  startDate: string;
  endDate: string;
};

type ViewMode = "widgets" | "table";
type SortField = "date" | "amount" | "category";
type SortOrder = "asc" | "desc";

export default function EnhancedMobileDashboard({
  transactions,
  startDate,
  endDate,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("widgets");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterAccount, setFilterAccount] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<
    Record<string, { amount: string; description: string; date: string }>
  >({});
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [categoryDetail, setCategoryDetail] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Calculate summary stats
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

    return {
      total,
      count: transactions.length,
      topCategory: topCategory
        ? { name: topCategory[0], amount: topCategory[1] }
        : null,
      byCategory,
    };
  }, [transactions]);

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
      if (sortField === "date") {
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

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditValues({
      ...editValues,
      [tx.id]: {
        amount: tx.amount.toString(),
        description: tx.description || "",
        date: tx.date,
      },
    });
  };

  const cancelEdit = (id: string) => {
    setEditingId(null);
    const newValues = { ...editValues };
    delete newValues[id];
    setEditValues(newValues);
  };

  const saveEdit = async (id: string) => {
    const values = editValues[id];
    if (!values) return;

    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(values.amount),
          description: values.description,
          date: values.date,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Transaction updated");
      setEditingId(null);
      const newValues = { ...editValues };
      delete newValues[id];
      setEditValues(newValues);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      // Refresh the page data
      window.location.reload();
    } catch (error) {
      toast.error("Failed to update transaction");
    }
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
      <div className="sticky top-[60px] z-20 bg-gradient-to-b from-[#1a2942] to-[#0f1d2e] border-b border-[#3b82f6]/20 px-3 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setViewMode("widgets")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              viewMode === "widgets"
                ? "neo-gradient text-white"
                : "neo-card text-[#38bdf8] hover:bg-[#3b82f6]/10"
            )}
          >
            📊 Widgets
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              viewMode === "table"
                ? "neo-gradient text-white"
                : "neo-card text-[#38bdf8] hover:bg-[#3b82f6]/10"
            )}
          >
            📑 Table
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "ml-auto p-2 rounded-lg neo-card hover:bg-[#3b82f6]/10 relative",
              hasActiveFilters && "ring-2 ring-[#06b6d4]/40"
            )}
          >
            <Filter className="w-5 h-5 text-[#38bdf8]" />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#06b6d4] rounded-full" />
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 space-y-2 animate-in slide-in-from-top duration-200">
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1a2942] border border-[#3b82f6]/30 text-white text-sm"
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
                className="flex-1 px-3 py-2 rounded-lg bg-[#1a2942] border border-[#3b82f6]/30 text-white text-sm"
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
                  className="p-2 rounded-lg neo-card hover:bg-[#3b82f6]/10"
                >
                  <X className="w-4 h-4 text-[#38bdf8]" />
                </button>
              )}
            </div>

            <div className="flex gap-2 text-xs">
              {(["date", "amount", "category"] as SortField[]).map((field) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg capitalize flex items-center gap-1",
                    sortField === field
                      ? "bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/40"
                      : "neo-card text-[#38bdf8]"
                  )}
                >
                  {field}
                  {sortField === field &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    ))}
                </button>
              ))}
            </div>

            {/* Results count */}
            <div className="text-xs text-[#38bdf8]/70 text-center">
              Showing {filteredTransactions.length} of {transactions.length}{" "}
              transactions
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-4">
        {viewMode === "widgets" && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="neo-card p-4 border-[#3b82f6]/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#38bdf8]/70">Total Spent</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      ${stats.total.toFixed(2)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-[#06b6d4]/40" />
                </div>
              </Card>

              <Card className="neo-card p-4 border-[#3b82f6]/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#38bdf8]/70">Transactions</p>
                    <p className="text-2xl font-bold text-white mt-1">
                      {stats.count}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-[#06b6d4]/40" />
                </div>
              </Card>
            </div>

            {/* Top Category */}
            {stats.topCategory && (
              <Card className="neo-card p-4 border-[#06b6d4]/30 bg-gradient-to-br from-[#06b6d4]/5 to-transparent">
                <p className="text-xs text-[#38bdf8]/70 mb-2">Top Category</p>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-white">
                    {stats.topCategory.name}
                  </p>
                  <p className="text-xl font-bold text-[#06b6d4]">
                    ${stats.topCategory.amount.toFixed(2)}
                  </p>
                </div>
              </Card>
            )}

            {/* Category Breakdown - Clickable */}
            <Card className="neo-card p-4 border-[#3b82f6]/20">
              <h3 className="text-sm font-semibold text-[#06b6d4] mb-3">
                By Category
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([cat, amt]) => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryClick(cat)}
                      className="w-full flex items-center justify-between p-2 rounded-lg bg-[#1a2942]/30 hover:bg-[#1a2942] border border-transparent hover:border-[#06b6d4]/30 transition-all group"
                    >
                      <span className="text-sm text-white truncate flex-1 text-left">
                        {cat}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#06b6d4]">
                          ${amt.toFixed(2)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#38bdf8] group-hover:text-[#06b6d4] transition-colors" />
                      </div>
                    </button>
                  ))}
              </div>
            </Card>

            {/* Recent Transactions Preview */}
            <Card className="neo-card p-4 border-[#3b82f6]/20">
              <h3 className="text-sm font-semibold text-[#06b6d4] mb-3">
                Recent
              </h3>
              <div className="space-y-2">
                {filteredTransactions.slice(0, 5).map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTransaction(tx)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-[#1a2942]/50 hover:bg-[#1a2942] border border-transparent hover:border-[#06b6d4]/30 transition-all"
                  >
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate">
                        {tx.category_icon} {tx.category}
                      </p>
                      <p className="text-xs text-[#38bdf8]/70">
                        {format(new Date(tx.date), "MMM d")} • {tx.account_name}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#06b6d4] ml-2">
                      ${tx.amount.toFixed(2)}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {viewMode === "table" && (
          <div className="overflow-x-auto -mx-3">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1a2942] border-b border-[#3b82f6]/30">
                <tr>
                  <th className="text-left p-2 text-[#06b6d4] font-semibold text-xs">
                    Date
                  </th>
                  <th className="text-left p-2 text-[#06b6d4] font-semibold text-xs">
                    Category
                  </th>
                  <th className="text-right p-2 text-[#06b6d4] font-semibold text-xs">
                    Amount
                  </th>
                  <th className="text-left p-2 text-[#06b6d4] font-semibold text-xs">
                    Account
                  </th>
                  <th className="text-center p-2 text-[#06b6d4] font-semibold text-xs">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const isEditing = editingId === tx.id;
                  const values = editValues[tx.id];

                  return (
                    <tr
                      key={tx.id}
                      className={cn(
                        "border-b border-[#3b82f6]/10 transition-colors",
                        isEditing ? "bg-[#1a2942]/50" : "hover:bg-[#1a2942]/30"
                      )}
                    >
                      <td className="p-2 text-white whitespace-nowrap text-xs">
                        {isEditing ? (
                          <Input
                            type="date"
                            value={values?.date || tx.date}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                [tx.id]: { ...values!, date: e.target.value },
                              })
                            }
                            className="h-7 text-xs bg-[#0f1d2e] border-[#06b6d4]/40"
                          />
                        ) : (
                          format(new Date(tx.date), "MMM d")
                        )}
                      </td>
                      <td className="p-2">
                        <div>
                          <span className="text-white text-xs">
                            {tx.category_icon} {tx.category}
                          </span>
                          {tx.subcategory && (
                            <span className="text-[#38bdf8]/60 text-xs ml-1">
                              • {tx.subcategory}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={values?.amount || tx.amount}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                [tx.id]: { ...values!, amount: e.target.value },
                              })
                            }
                            className="h-7 w-20 text-xs bg-[#0f1d2e] border-[#06b6d4]/40 ml-auto"
                          />
                        ) : (
                          <span className="text-[#06b6d4] font-semibold text-xs">
                            ${tx.amount.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-[#38bdf8]/70 text-xs truncate max-w-[100px]">
                        {tx.account_name}
                      </td>
                      <td className="p-2 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => saveEdit(tx.id)}
                              className="p-1 rounded hover:bg-[#06b6d4]/10 text-[#06b6d4]"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => cancelEdit(tx.id)}
                              className="p-1 rounded hover:bg-red-500/10 text-red-400"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEdit(tx)}
                              className="p-1 rounded hover:bg-[#3b82f6]/10"
                            >
                              <Edit2 className="w-4 h-4 text-[#38bdf8]" />
                            </button>
                            <button
                              onClick={() => setSelectedTransaction(tx)}
                              className="p-1 rounded hover:bg-[#3b82f6]/10 text-[#06b6d4]"
                            >
                              →
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredTransactions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#38bdf8]/70">No transactions found</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 px-4 py-2 rounded-lg neo-gradient text-white text-sm"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
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
            window.location.reload();
          }}
          onDelete={() => {
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
