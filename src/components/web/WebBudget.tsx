"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useAiBudgetSuggestion,
  useBudgetAllocations,
  useGenerateAiBudgetSuggestion,
  useSaveBudgetAllocation,
} from "@/features/budget/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import type {
  AiCategorySuggestion,
  BudgetCategoryView,
  BudgetOwnershipFilter,
  BudgetSummary,
  BudgetWeek,
} from "@/types/budgetAllocation";
import { BUDGET_WEEK_LABELS } from "@/types/budgetAllocation";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Edit3,
  Heart,
  Lightbulb,
  Loader2,
  PieChart,
  Settings2,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

// ===== Ownership Toggle (Me / Both / Partner) =====
const OwnershipToggle = memo(function OwnershipToggle({
  value,
  onChange,
  hasPartner,
  tc,
}: {
  value: BudgetOwnershipFilter;
  onChange: (v: BudgetOwnershipFilter) => void;
  hasPartner: boolean;
  tc: ReturnType<typeof useThemeClasses>;
}) {
  const items: {
    id: BudgetOwnershipFilter;
    icon: typeof User;
    label: string;
  }[] = hasPartner
    ? [
        { id: "mine", icon: User, label: "Me" },
        { id: "all", icon: Users, label: "Both" },
        { id: "partner", icon: Heart, label: "Partner" },
      ]
    : [
        { id: "mine", icon: User, label: "Me" },
        { id: "all", icon: Users, label: "Both" },
      ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl neo-card">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            value === item.id
              ? `${tc.bgActive} ${tc.textActive}`
              : "text-slate-400 hover:text-slate-300 hover:bg-white/5",
          )}
        >
          <item.icon className="w-3.5 h-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
});

// ===== Account Filter =====
const AccountFilter = memo(function AccountFilter({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: { id: string; name: string; type: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const expenseAccounts = accounts.filter((a) => a.type === "expense");
  if (expenseAccounts.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
          selectedId === null
            ? "bg-white/15 text-white"
            : "bg-white/5 text-slate-400 hover:bg-white/10",
        )}
      >
        All Accounts
      </button>
      {expenseAccounts.map((acc) => (
        <button
          key={acc.id}
          onClick={() => onSelect(acc.id)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
            selectedId === acc.id
              ? "bg-white/15 text-white"
              : "bg-white/5 text-slate-400 hover:bg-white/10",
          )}
        >
          {acc.name}
        </button>
      ))}
    </div>
  );
});

// ===== Week Review Toggle =====
const WeekToggle = memo(function WeekToggle({
  value,
  onChange,
  currentWeekIndex,
  weeksWithAi,
}: {
  value: BudgetWeek;
  onChange: (w: BudgetWeek) => void;
  currentWeekIndex: number;
  weeksWithAi?: string[];
}) {
  const weeks: BudgetWeek[] = ["w0", "w1", "w2", "w3", "w4"];

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5">
      {weeks.map((w) => {
        const weekNum = parseInt(w.slice(1));
        const isActive = value === w;
        const isPast = weekNum < currentWeekIndex;
        const isCurrent = weekNum === currentWeekIndex;
        const hasAi = weeksWithAi?.includes(w);

        return (
          <button
            key={w}
            onClick={() => onChange(w)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all relative",
              isActive
                ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30"
                : isPast
                  ? "text-slate-500 hover:text-slate-400 hover:bg-white/5"
                  : "text-slate-400 hover:bg-white/5",
            )}
          >
            {BUDGET_WEEK_LABELS[w]}
            {isCurrent && !isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-400" />
            )}
            {hasAi && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
            )}
          </button>
        );
      })}
    </div>
  );
});

// ===== Wallet Balance Card (replaces Income Balance) =====
const WalletBalanceCard = memo(function WalletBalanceCard({
  summary,
  ownershipFilter,
}: {
  summary: BudgetSummary;
  ownershipFilter: BudgetOwnershipFilter;
}) {
  const displayBalance = useMemo(() => {
    if (ownershipFilter === "mine") return summary.user_wallet_balance;
    if (ownershipFilter === "partner") return summary.partner_wallet_balance;
    return summary.wallet_balance;
  }, [summary, ownershipFilter]);

  const allocated = summary.total_budget;
  const unallocated = displayBalance - allocated;
  const allocationPct =
    displayBalance > 0 ? Math.min((allocated / displayBalance) * 100, 100) : 0;

  return (
    <Card className="neo-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20">
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">
              Wallet Balance
              {ownershipFilter === "all" &&
                summary.partner_wallet_balance > 0 && (
                  <span className="text-xs text-slate-500 ml-1">
                    (Combined)
                  </span>
                )}
            </p>
            <p className="text-2xl font-bold text-emerald-300">
              $
              {displayBalance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Allocated</p>
          <p className="text-lg font-semibold text-violet-300">
            ${allocated.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Allocation progress bar */}
      <div className="h-2.5 bg-slate-800/50 rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${allocationPct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            background:
              allocationPct > 100
                ? "linear-gradient(90deg, #ef4444, #f87171)"
                : "linear-gradient(90deg, #8b5cf6, #a78bfa)",
            boxShadow:
              allocationPct > 100
                ? "0 0 12px rgba(239,68,68,0.4)"
                : "0 0 12px rgba(139,92,246,0.4)",
          }}
        />
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-slate-500">
          {allocationPct.toFixed(0)}% allocated
        </span>
        <span
          className={cn(
            "font-medium",
            unallocated >= 0 ? "text-emerald-400" : "text-red-400",
          )}
        >
          {unallocated >= 0 ? "$" : "-$"}
          {Math.abs(unallocated).toLocaleString()} unallocated
        </span>
      </div>

      {/* Per-user breakdown when "Both" is selected */}
      {ownershipFilter === "all" && summary.partner_wallet_balance > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs text-slate-400">Me</span>
            <span className="text-xs font-medium text-blue-300 ml-auto">
              ${summary.user_wallet_balance.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pink-400" />
            <span className="text-xs text-slate-400">Partner</span>
            <span className="text-xs font-medium text-pink-300 ml-auto">
              ${summary.partner_wallet_balance.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
});

// ===== Spending Stats Row =====
const SpendingStats = memo(function SpendingStats({
  summary,
  ownershipFilter,
}: {
  summary: BudgetSummary;
  ownershipFilter: BudgetOwnershipFilter;
}) {
  const spent = useMemo(() => {
    if (ownershipFilter === "mine") return summary.user_spent;
    if (ownershipFilter === "partner") return summary.partner_spent;
    return summary.total_spent;
  }, [summary, ownershipFilter]);

  const budget = useMemo(() => {
    if (ownershipFilter === "mine") return summary.user_budget;
    if (ownershipFilter === "partner") return summary.partner_budget;
    return summary.total_budget;
  }, [summary, ownershipFilter]);

  const remaining = budget - spent;
  const pctUsed = budget > 0 ? (spent / budget) * 100 : 0;

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <Card className="neo-card p-4 text-center">
        <TrendingUp className="w-4 h-4 text-violet-400 mx-auto mb-1" />
        <p className="text-xs text-slate-500">Budget</p>
        <p className="text-lg font-bold text-white">
          ${budget.toLocaleString()}
        </p>
      </Card>
      <Card className="neo-card p-4 text-center">
        <TrendingDown className="w-4 h-4 text-amber-400 mx-auto mb-1" />
        <p className="text-xs text-slate-500">Spent</p>
        <p className="text-lg font-bold text-amber-300">
          ${spent.toLocaleString()}
        </p>
        <p className="text-[10px] text-slate-500">{pctUsed.toFixed(0)}% used</p>
      </Card>
      <Card className="neo-card p-4 text-center">
        {remaining >= 0 ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
        )}
        <p className="text-xs text-slate-500">Remaining</p>
        <p
          className={cn(
            "text-lg font-bold",
            remaining >= 0 ? "text-emerald-300" : "text-red-300",
          )}
        >
          {remaining < 0 ? "-" : ""}${Math.abs(remaining).toLocaleString()}
        </p>
      </Card>
    </div>
  );
});

// ===== Category Budget Card =====
const CategoryBudgetCard = memo(function CategoryBudgetCard({
  category,
  incomeBalance,
  totalAllocated,
  onBudgetChange,
  onSubPercentageChange,
  ownershipFilter,
  aiSuggestion,
  onApplyAiSuggestion,
}: {
  category: BudgetCategoryView;
  incomeBalance: number;
  totalAllocated: number;
  onBudgetChange: (
    categoryId: string,
    accountId: string,
    amount: number,
  ) => void;
  onSubPercentageChange: (
    categoryId: string,
    subcategoryId: string,
    accountId: string,
    pct: number,
  ) => void;
  ownershipFilter: BudgetOwnershipFilter;
  aiSuggestion?: AiCategorySuggestion;
  onApplyAiSuggestion?: (
    categoryId: string,
    accountId: string,
    amount: number,
  ) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const budget = category.total_budget;
  const spent = useMemo(() => {
    if (ownershipFilter === "mine") return category.user_spent;
    if (ownershipFilter === "partner") return category.partner_spent;
    return category.total_spent;
  }, [category, ownershipFilter]);

  const remaining = budget - spent;
  const isOver = remaining < 0;
  const spentPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const maxAvailable = incomeBalance - totalAllocated + budget;

  const hasSubcategories =
    category.subcategories && category.subcategories.length > 0;

  // Subcategory percentages (local state for editing)
  const [subPercentages, setSubPercentages] = useState<Record<string, number>>(
    () => {
      if (!hasSubcategories) return {};
      const map: Record<string, number> = {};
      const subs = category.subcategories!;
      const totalSubBudget = subs.reduce((s, sub) => s + sub.total_budget, 0);
      subs.forEach((sub) => {
        if (totalSubBudget > 0) {
          map[sub.subcategory_id] = Math.round(
            (sub.total_budget / totalSubBudget) * 100,
          );
        } else {
          // Distribute evenly
          map[sub.subcategory_id] = Math.round(100 / subs.length);
        }
      });
      return map;
    },
  );

  const handleStartEdit = () => {
    setEditValue(budget.toString());
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommitEdit = () => {
    const num = Math.max(0, parseInt(editValue, 10) || 0);
    onBudgetChange(category.category_id, category.account_id, num);
    setIsEditing(false);
  };

  const handleSubPercentageChange = (subId: string, newPct: number) => {
    const subs = category.subcategories!;
    const clampedPct = Math.max(0, Math.min(100, newPct));
    const otherSubs = subs.filter((s) => s.subcategory_id !== subId);

    // Distribute remaining percentage proportionally among others
    const remainingPct = 100 - clampedPct;
    const otherTotal = otherSubs.reduce(
      (s, sub) => s + (subPercentages[sub.subcategory_id] || 0),
      0,
    );

    const newMap: Record<string, number> = { [subId]: clampedPct };
    otherSubs.forEach((sub) => {
      const oldPct = subPercentages[sub.subcategory_id] || 0;
      newMap[sub.subcategory_id] =
        otherTotal > 0
          ? Math.round((oldPct / otherTotal) * remainingPct)
          : Math.round(remainingPct / otherSubs.length);
    });

    setSubPercentages(newMap);

    // Save subcategory allocations based on percentages
    subs.forEach((sub) => {
      const pct = newMap[sub.subcategory_id] || 0;
      onSubPercentageChange(
        category.category_id,
        sub.subcategory_id,
        category.account_id,
        pct,
      );
    });
  };

  const IconComponent = getCategoryIcon(category.category_name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
    >
      <Card
        className={cn(
          "neo-card transition-all duration-200 overflow-hidden",
          isOver && "ring-1 ring-red-500/30",
        )}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="p-2 rounded-lg flex-shrink-0"
              style={{
                backgroundColor: `${category.category_color}20`,
                color: category.category_color,
              }}
            >
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold text-sm truncate"
                style={{ color: category.category_color }}
              >
                {category.category_name}
              </h3>
              {isOver ? (
                <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" /> Over by $
                  {Math.abs(remaining).toLocaleString()}
                </span>
              ) : budget > 0 ? (
                <span className="text-[10px] text-slate-500">
                  ${spent.toLocaleString()} / ${budget.toLocaleString()} spent
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">
                  No budget set
                </span>
              )}
            </div>

            {/* Budget amount */}
            <div className="text-right flex-shrink-0">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-400">$</span>
                  <Input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleCommitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitEdit();
                      if (e.key === "Escape") setIsEditing(false);
                    }}
                    className="w-20 h-7 text-sm text-right bg-slate-800/50 border-slate-700"
                  />
                </div>
              ) : (
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded transition-all group"
                >
                  <span className="text-lg font-bold text-white">
                    ${budget.toLocaleString()}
                  </span>
                  <Edit3 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {budget > 0 && (
            <div className="mb-2">
              <div className="h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${spentPct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{
                    background: isOver
                      ? "linear-gradient(90deg, #ef4444, #f87171)"
                      : `linear-gradient(90deg, ${category.category_color}cc, ${category.category_color})`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Quick budget presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[50, 100, 200, 500, 1000].map((amt) => (
              <button
                key={amt}
                onClick={() =>
                  onBudgetChange(category.category_id, category.account_id, amt)
                }
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                  budget === amt
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300",
                )}
              >
                ${amt}
              </button>
            ))}
            {maxAvailable > 0 && (
              <span className="text-[10px] text-slate-600 ml-auto">
                max: ${Math.max(0, maxAvailable).toLocaleString()}
              </span>
            )}
          </div>

          {/* AI suggestion hint */}
          {aiSuggestion && (
            <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-amber-300">
                AI suggests:{" "}
                <span className="font-semibold">
                  ${aiSuggestion.suggested_budget.toLocaleString()}
                </span>
              </span>
              {onApplyAiSuggestion &&
                aiSuggestion.suggested_budget !== budget && (
                  <button
                    onClick={() =>
                      onApplyAiSuggestion(
                        category.category_id,
                        category.account_id,
                        aiSuggestion.suggested_budget,
                      )
                    }
                    className="ml-auto px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    Apply
                  </button>
                )}
            </div>
          )}
        </div>

        {/* Subcategory % Spread */}
        {hasSubcategories && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <PieChart className="w-3 h-3" />
                {category.subcategories!.length} subcategories
              </span>
              <span className="text-[10px] text-slate-500">Set % spread</span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 space-y-2">
                    {category.subcategories!.map((sub) => {
                      const pct = subPercentages[sub.subcategory_id] || 0;
                      const allocatedAmount =
                        budget > 0 ? Math.round((pct / 100) * budget) : 0;
                      const subSpent =
                        ownershipFilter === "mine"
                          ? sub.user_spent
                          : ownershipFilter === "partner"
                            ? sub.partner_spent
                            : sub.total_spent;
                      const SubIcon = getCategoryIcon(sub.subcategory_name);

                      return (
                        <div
                          key={sub.subcategory_id}
                          className="flex items-center gap-3 pl-2"
                        >
                          <SubIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">
                            {sub.subcategory_name}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={pct}
                              onChange={(e) =>
                                handleSubPercentageChange(
                                  sub.subcategory_id,
                                  parseInt(e.target.value, 10),
                                )
                              }
                              className="w-16 h-1 accent-violet-500"
                            />
                            <span className="text-xs font-medium text-violet-300 w-8 text-right">
                              {pct}%
                            </span>
                            <span className="text-xs text-slate-500 w-14 text-right">
                              ${allocatedAmount.toLocaleString()}
                            </span>
                          </div>
                          {subSpent > 0 && (
                            <span className="text-[10px] text-slate-500 w-10 text-right">
                              -${subSpent.toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </Card>
    </motion.div>
  );
});

// ===== AI Suggestion View (read-only) =====
const AiSuggestionView = memo(function AiSuggestionView({
  suggestions,
  totalSuggested,
  walletBalance,
  categories,
  ownershipFilter,
}: {
  suggestions: AiCategorySuggestion[];
  totalSuggested: number;
  walletBalance: number;
  categories: BudgetCategoryView[];
  ownershipFilter: BudgetOwnershipFilter;
}) {
  const remaining = walletBalance - totalSuggested;

  return (
    <div className="space-y-4">
      {/* AI Summary */}
      <Card className="neo-card p-4 border-l-2 border-l-amber-500/50">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-300">
            AI Budget Suggestion
          </h3>
          <span className="ml-auto text-xs text-slate-500">Read-only</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-slate-500">Wallet</p>
            <p className="text-sm font-bold text-emerald-300">
              ${walletBalance.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Suggested</p>
            <p className="text-sm font-bold text-amber-300">
              ${totalSuggested.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">Leftover</p>
            <p
              className={cn(
                "text-sm font-bold",
                remaining >= 0 ? "text-emerald-300" : "text-red-300",
              )}
            >
              ${Math.abs(remaining).toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      {/* AI Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((s) => {
          const matchingCat = categories.find(
            (c) =>
              c.category_id === s.category_id ||
              c.category_name === s.category_name,
          );
          const IconComp = getCategoryIcon(s.category_name);
          const color = matchingCat?.category_color || "#a78bfa";
          const spent = matchingCat
            ? ownershipFilter === "mine"
              ? matchingCat.user_spent
              : ownershipFilter === "partner"
                ? matchingCat.partner_spent
                : matchingCat.total_spent
            : 0;
          const spentPct =
            s.suggested_budget > 0
              ? Math.min((spent / s.suggested_budget) * 100, 100)
              : 0;

          return (
            <Card
              key={s.category_id}
              className="neo-card overflow-hidden border border-amber-500/10"
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{
                      backgroundColor: `${color}20`,
                      color,
                    }}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-sm truncate"
                      style={{ color }}
                    >
                      {s.category_name}
                    </h3>
                    <span className="text-[10px] text-slate-500">
                      ${spent.toLocaleString()} spent
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span className="text-lg font-bold text-amber-300">
                      ${s.suggested_budget.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                {s.suggested_budget > 0 && (
                  <div className="h-1.5 bg-slate-800/50 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${spentPct}%`,
                        background:
                          spent > s.suggested_budget
                            ? "linear-gradient(90deg, #ef4444, #f87171)"
                            : `linear-gradient(90deg, ${color}cc, ${color})`,
                      }}
                    />
                  </div>
                )}

                {/* Reasoning */}
                <p className="text-[10px] text-slate-400 italic leading-relaxed">
                  {s.reasoning}
                </p>

                {/* Subcategory breakdown */}
                {s.subcategories && s.subcategories.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-white/5 space-y-1.5">
                    {s.subcategories.map((sub, subIdx) => {
                      const SubIcon = getCategoryIcon(sub.subcategory_name);
                      return (
                        <div
                          key={`${sub.subcategory_id}-${subIdx}`}
                          className="flex items-center gap-2 pl-1"
                        >
                          <SubIcon className="w-3 h-3 text-slate-500" />
                          <span className="text-xs text-slate-300 flex-1 truncate">
                            {sub.subcategory_name}
                          </span>
                          <span className="text-xs text-amber-300/70 font-medium">
                            {sub.percentage}%
                          </span>
                          <span className="text-xs text-slate-500 w-12 text-right">
                            ${sub.suggested_amount.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Manual allocation comparison */}
                {matchingCat && matchingCat.total_budget > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Settings2 className="w-3 h-3" />
                    Manual: ${matchingCat.total_budget.toLocaleString()}
                    {matchingCat.total_budget !== s.suggested_budget && (
                      <span
                        className={cn(
                          "ml-1",
                          s.suggested_budget > matchingCat.total_budget
                            ? "text-amber-400"
                            : "text-emerald-400",
                        )}
                      >
                        (
                        {s.suggested_budget > matchingCat.total_budget
                          ? "+"
                          : ""}
                        $
                        {(
                          s.suggested_budget - matchingCat.total_budget
                        ).toLocaleString()}
                        )
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
});

// ===== Dashboard Quick View =====
const BudgetDashboardView = memo(function BudgetDashboardView({
  summary,
  ownershipFilter,
}: {
  summary: BudgetSummary;
  ownershipFilter: BudgetOwnershipFilter;
}) {
  const categoriesSorted = useMemo(() => {
    return [...summary.categories].sort(
      (a, b) => b.total_spent - a.total_spent,
    );
  }, [summary.categories]);

  const topOverspent = useMemo(
    () =>
      categoriesSorted.filter(
        (c) => c.total_spent > c.total_budget && c.total_budget > 0,
      ),
    [categoriesSorted],
  );

  const topUnderspent = useMemo(
    () =>
      categoriesSorted.filter(
        (c) =>
          c.total_budget > 0 &&
          c.total_spent <= c.total_budget &&
          c.total_budget - c.total_spent > 0,
      ),
    [categoriesSorted],
  );

  return (
    <div className="space-y-4">
      {/* Budget Health */}
      <Card className="neo-card p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" />
          Budget Health
        </h3>
        <div className="space-y-3">
          {summary.categories.map((cat) => {
            const pct =
              cat.total_budget > 0
                ? (cat.total_spent / cat.total_budget) * 100
                : 0;
            const isOver = pct > 100;
            const IconComp = getCategoryIcon(cat.category_name);

            return (
              <div key={cat.category_id} className="flex items-center gap-3">
                <span
                  className="flex-shrink-0"
                  style={{ color: cat.category_color }}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs text-slate-300 w-20 truncate">
                  {cat.category_name}
                </span>
                <div className="flex-1 h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: isOver
                        ? "#ef4444"
                        : pct > 80
                          ? "#f59e0b"
                          : cat.category_color,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium w-10 text-right",
                    isOver
                      ? "text-red-400"
                      : pct > 80
                        ? "text-amber-400"
                        : "text-slate-400",
                  )}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Insights */}
      <Card className="neo-card p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Insights
        </h3>
        <div className="space-y-2">
          {topOverspent.length > 0 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">
                <span className="font-medium">Over budget:</span>{" "}
                {topOverspent.map((c) => c.category_name).join(", ")}
              </p>
            </div>
          )}
          {topUnderspent.length > 0 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-300">
                <span className="font-medium">On track:</span>{" "}
                {topUnderspent
                  .slice(0, 3)
                  .map((c) => c.category_name)
                  .join(", ")}
                {topUnderspent.length > 3 &&
                  ` +${topUnderspent.length - 3} more`}
              </p>
            </div>
          )}
          {summary.unallocated > 0 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-violet-500/10">
              <DollarSign className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-300">
                <span className="font-medium">
                  ${summary.unallocated.toLocaleString()}
                </span>{" "}
                unallocated &mdash; consider distributing to savings or
                emergency fund
              </p>
            </div>
          )}
          {summary.total_budget > 0 && summary.total_spent === 0 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/10">
              <Lightbulb className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-300">
                Budget set but no spending yet this month &mdash; you&apos;re
                starting fresh!
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Category Spending Breakdown */}
      <Card className="neo-card p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          Spending vs Budget
        </h3>
        <div className="space-y-3">
          {categoriesSorted.map((cat) => {
            const catSpent =
              ownershipFilter === "mine"
                ? cat.user_spent
                : ownershipFilter === "partner"
                  ? cat.partner_spent
                  : cat.total_spent;
            const CatIcon = getCategoryIcon(cat.category_name);

            return (
              <div key={cat.category_id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span style={{ color: cat.category_color }}>
                      <CatIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs text-slate-300">
                      {cat.category_name}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-amber-300">
                      ${catSpent.toLocaleString()}
                    </span>
                    <span className="text-slate-600"> / </span>
                    <span className="text-slate-400">
                      ${cat.total_budget.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 h-2">
                  {cat.total_budget > 0 && (
                    <>
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${Math.min(
                            (catSpent / Math.max(cat.total_budget, catSpent)) *
                              100,
                            100,
                          )}%`,
                          backgroundColor:
                            catSpent > cat.total_budget
                              ? "#ef4444"
                              : cat.category_color,
                        }}
                      />
                      {catSpent < cat.total_budget && (
                        <div
                          className="h-full rounded-sm bg-slate-800/40"
                          style={{
                            width: `${
                              ((cat.total_budget - catSpent) /
                                Math.max(cat.total_budget, catSpent)) *
                              100
                            }%`,
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
});

// ===== Main Component =====
const WebBudget = memo(function WebBudget() {
  const tc = useThemeClasses();
  const currentMonth = format(new Date(), "yyyy-MM");

  // State
  const [ownershipFilter, setOwnershipFilter] =
    useState<BudgetOwnershipFilter>("all");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [activeWeek, setActiveWeek] = useState<BudgetWeek>(() => {
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth <= 7) return "w0";
    if (dayOfMonth <= 14) return "w1";
    if (dayOfMonth <= 21) return "w2";
    if (dayOfMonth <= 28) return "w3";
    return "w4";
  });
  const [view, setView] = useState<"edit" | "ai" | "dashboard">("edit");
  const [showAiConfirm, setShowAiConfirm] = useState(false);

  // Current week index for highlighting
  const currentWeekIndex = useMemo(() => {
    const day = new Date().getDate();
    if (day <= 7) return 0;
    if (day <= 14) return 1;
    if (day <= 21) return 2;
    if (day <= 28) return 3;
    return 4;
  }, []);

  // Data
  const { data, isLoading, error } = useBudgetAllocations(
    currentMonth,
    selectedAccountId || undefined,
  );
  const saveMutation = useSaveBudgetAllocation();

  // AI suggestion data
  const { data: aiData, isLoading: aiLoading } = useAiBudgetSuggestion(
    currentMonth,
    activeWeek,
  );
  const generateAi = useGenerateAiBudgetSuggestion();

  const aiSuggestion = aiData?.suggestion ?? null;
  const weeksWithAi = aiData?.weeksWithSuggestions ?? [];

  // Build AI suggestion lookup map by category name (for hints in manual mode)
  const aiSuggestionMap = useMemo(() => {
    if (!aiSuggestion) return new Map<string, AiCategorySuggestion>();
    const map = new Map<string, AiCategorySuggestion>();
    for (const s of aiSuggestion.suggestions) {
      map.set(s.category_id, s);
      map.set(s.category_name, s);
    }
    return map;
  }, [aiSuggestion]);

  const summary = data?.summary;
  const hasPartner = data?.hasPartner ?? false;
  const accounts = data?.accounts ?? [];

  // Wallet balance based on ownership
  const displayWalletBalance = useMemo(() => {
    if (!summary) return 0;
    if (ownershipFilter === "mine") return summary.user_wallet_balance;
    if (ownershipFilter === "partner") return summary.partner_wallet_balance;
    return summary.wallet_balance;
  }, [summary, ownershipFilter]);

  // Total allocated across all categories
  const totalAllocated = useMemo(() => summary?.total_budget ?? 0, [summary]);

  // Save budget for a category
  const handleBudgetChange = useCallback(
    (categoryId: string, accountId: string, amount: number) => {
      saveMutation.mutate({
        category_id: categoryId,
        subcategory_id: null,
        account_id: accountId,
        assigned_to: "both",
        monthly_budget: amount,
        budget_month: null,
      });
    },
    [saveMutation],
  );

  // Save subcategory percentage allocation
  const handleSubPercentageChange = useCallback(
    (
      categoryId: string,
      subcategoryId: string,
      accountId: string,
      pct: number,
    ) => {
      // Find the parent category's budget
      const cat = summary?.categories.find((c) => c.category_id === categoryId);
      if (!cat) return;

      const amount = Math.round((pct / 100) * cat.total_budget);
      saveMutation.mutate({
        category_id: categoryId,
        subcategory_id: subcategoryId,
        account_id: accountId,
        assigned_to: "both",
        monthly_budget: amount,
        budget_month: null,
      });
    },
    [saveMutation, summary],
  );

  // AI generation handler
  const handleAiGenerate = useCallback(
    (force = false) => {
      setShowAiConfirm(false);
      generateAi.mutate(
        { month: currentMonth, week: activeWeek, force },
        {
          onSuccess: (data) => {
            if (data.exists && !force) {
              setShowAiConfirm(true);
            } else {
              setView("ai");
            }
          },
        },
      );
    },
    [generateAi, currentMonth, activeWeek],
  );

  return (
    <div className={`min-h-screen ${tc.pageBg} pb-24`}>
      {/* AI re-run confirmation overlay */}
      {showAiConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="neo-card p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-semibold text-white">
                AI Already Ran
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              An AI suggestion already exists for{" "}
              <span className="text-violet-300 font-medium">
                {BUDGET_WEEK_LABELS[activeWeek]}
              </span>
              . Do you want to regenerate it?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAiConfirm(false)}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAiGenerate(true)}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors font-medium"
              >
                Regenerate
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <div
        className={`sticky top-0 z-20 ${tc.headerGradient} backdrop-blur-xl border-b border-white/5`}
      >
        <div className="max-w-5xl mx-auto py-3 px-4 md:px-6">
          {/* Top row: title + AI button + ownership toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Wallet className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1
                  className={`text-lg font-bold bg-gradient-to-r ${tc.titleGradient} bg-clip-text text-transparent`}
                >
                  Monthly Budget
                </h1>
                <p className="text-[11px] text-slate-500">
                  {format(new Date(), "MMMM yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* AI Suggest Button */}
              <button
                onClick={() => handleAiGenerate(false)}
                disabled={generateAi.isPending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                  generateAi.isPending
                    ? "bg-amber-500/10 text-amber-400/50 cursor-wait"
                    : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 ring-1 ring-amber-500/20",
                )}
              >
                {generateAi.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generateAi.isPending ? "Analyzing..." : "AI Suggest"}
              </button>
              <OwnershipToggle
                value={ownershipFilter}
                onChange={setOwnershipFilter}
                hasPartner={hasPartner}
                tc={tc}
              />
            </div>
          </div>

          {/* Second row: account filter + week toggle */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <AccountFilter
              accounts={accounts}
              selectedId={selectedAccountId}
              onSelect={setSelectedAccountId}
            />
            <WeekToggle
              value={activeWeek}
              onChange={setActiveWeek}
              currentWeekIndex={currentWeekIndex}
              weeksWithAi={weeksWithAi}
            />
          </div>

          {/* View toggle: Allocate / AI / Dashboard */}
          <div className="flex items-center gap-1 mt-3 p-1 rounded-xl bg-white/5 w-fit">
            <button
              onClick={() => setView("edit")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                view === "edit"
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-slate-400 hover:text-slate-300 hover:bg-white/5",
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Allocate
            </button>
            <button
              onClick={() => setView("ai")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                view === "ai"
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-slate-400 hover:text-slate-300 hover:bg-white/5",
                !aiSuggestion && "opacity-50",
              )}
              disabled={!aiSuggestion && !aiLoading}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI View
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                view === "dashboard"
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-slate-400 hover:text-slate-300 hover:bg-white/5",
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">
        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading budget...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="neo-card p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 text-sm">Failed to load budget data</p>
          </Card>
        )}

        {summary && (
          <>
            {/* Wallet Balance */}
            <WalletBalanceCard
              summary={summary}
              ownershipFilter={ownershipFilter}
            />

            {/* Week review context banner */}
            {activeWeek !== "w0" && (
              <Card className="neo-card p-3 mb-4 border-l-2 border-l-violet-500/50">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
                  <p className="text-xs text-slate-400">
                    <span className="font-medium text-violet-300">
                      {BUDGET_WEEK_LABELS[activeWeek]} Review
                    </span>{" "}
                    &mdash; Review previous weeks and adjust allocations based
                    on actual spending.
                    {activeWeek === "w1" &&
                      " Compare against your initial plan (W0)."}
                    {activeWeek === "w2" &&
                      " Analyze W0→W1 trends and course correct."}
                    {activeWeek === "w3" &&
                      " Final stretch — tighten where needed."}
                    {activeWeek === "w4" &&
                      " Close out the month. Any leftover? Save it."}
                  </p>
                </div>
              </Card>
            )}

            {/* Spending Stats */}
            <SpendingStats
              summary={summary}
              ownershipFilter={ownershipFilter}
            />

            {/* Edit View: Category allocation */}
            {view === "edit" && (
              <>
                {summary.categories.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <AnimatePresence>
                      {summary.categories.map((cat) => (
                        <CategoryBudgetCard
                          key={cat.category_id}
                          category={cat}
                          incomeBalance={displayWalletBalance}
                          totalAllocated={totalAllocated}
                          onBudgetChange={handleBudgetChange}
                          onSubPercentageChange={handleSubPercentageChange}
                          ownershipFilter={ownershipFilter}
                          aiSuggestion={
                            aiSuggestionMap.get(cat.category_id) ??
                            aiSuggestionMap.get(cat.category_name)
                          }
                          onApplyAiSuggestion={handleBudgetChange}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Card className="neo-card p-10 text-center">
                    <BarChart3 className="w-14 h-14 text-violet-400/30 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-white mb-1">
                      No Categories
                    </h3>
                    <p className="text-sm text-slate-400">
                      Add expense accounts and categories to start budgeting.
                    </p>
                  </Card>
                )}

                {/* Budget over wallet warning */}
                {totalAllocated > displayWalletBalance &&
                  displayWalletBalance > 0 && (
                    <Card className="neo-card p-3 mt-4 border-l-2 border-l-red-500/50">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        <p className="text-xs text-red-300">
                          Total allocated (${totalAllocated.toLocaleString()})
                          exceeds wallet ($
                          {displayWalletBalance.toLocaleString()}) by{" "}
                          <span className="font-medium">
                            $
                            {(
                              totalAllocated - displayWalletBalance
                            ).toLocaleString()}
                          </span>
                        </p>
                      </div>
                    </Card>
                  )}
              </>
            )}

            {/* AI View */}
            {view === "ai" && (
              <>
                {aiLoading && (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">
                      Loading AI suggestion...
                    </p>
                  </div>
                )}
                {!aiLoading && aiSuggestion && (
                  <AiSuggestionView
                    suggestions={aiSuggestion.suggestions}
                    totalSuggested={aiSuggestion.total_suggested}
                    walletBalance={aiSuggestion.wallet_balance_used}
                    categories={summary.categories}
                    ownershipFilter={ownershipFilter}
                  />
                )}
                {!aiLoading && !aiSuggestion && (
                  <Card className="neo-card p-10 text-center">
                    <Sparkles className="w-14 h-14 text-amber-400/30 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-white mb-1">
                      No AI Suggestion Yet
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      Click &ldquo;AI Suggest&rdquo; to generate a budget
                      recommendation for{" "}
                      <span className="text-violet-300">
                        {BUDGET_WEEK_LABELS[activeWeek]}
                      </span>
                      .
                    </p>
                    <button
                      onClick={() => handleAiGenerate(false)}
                      disabled={generateAi.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 transition-all"
                    >
                      {generateAi.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Generate AI Suggestion
                    </button>
                  </Card>
                )}
              </>
            )}

            {/* Dashboard View */}
            {view === "dashboard" && (
              <BudgetDashboardView
                summary={summary}
                ownershipFilter={ownershipFilter}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default WebBudget;
