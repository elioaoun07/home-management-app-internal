"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  useBudgetAllocations,
  useSaveBudgetAllocation,
} from "@/features/budget/hooks";
import { useMyAccounts } from "@/features/accounts/hooks";
import type {
  BudgetAssignment,
  BudgetCategoryView,
  BudgetSubcategoryView,
} from "@/types/budgetAllocation";
import { ASSIGNMENT_LABELS, ASSIGNMENT_COLORS } from "@/types/budgetAllocation";
import { format } from "date-fns";

// Assignment toggle component
const AssignmentToggle = memo(function AssignmentToggle({
  value,
  onChange,
  hasPartner,
  compact = false,
}: {
  value: BudgetAssignment;
  onChange: (v: BudgetAssignment) => void;
  hasPartner: boolean;
  compact?: boolean;
}) {
  const options: BudgetAssignment[] = hasPartner
    ? ["user", "partner", "both"]
    : ["user", "both"];

  return (
    <div className={cn("flex gap-1", compact ? "scale-90" : "")}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "px-2 py-1 rounded-lg text-xs font-medium transition-all",
            value === opt
              ? "ring-2 ring-offset-1 ring-offset-slate-900"
              : "opacity-60 hover:opacity-100"
          )}
          style={{
            backgroundColor: `${ASSIGNMENT_COLORS[opt]}20`,
            color: ASSIGNMENT_COLORS[opt],
            ...(value === opt && { boxShadow: `0 0 0 2px ${ASSIGNMENT_COLORS[opt]}` }),
          }}
        >
          {opt === "user" && <User className="w-3 h-3 inline mr-1" />}
          {opt === "partner" && <User className="w-3 h-3 inline mr-1" />}
          {opt === "both" && <Users className="w-3 h-3 inline mr-1" />}
          {!compact && ASSIGNMENT_LABELS[opt]}
        </button>
      ))}
    </div>
  );
});

// Subcategory budget row
const SubcategoryBudgetRow = memo(function SubcategoryBudgetRow({
  subcategory,
  categoryId,
  accountId,
  hasPartner,
  onSave,
}: {
  subcategory: BudgetSubcategoryView;
  categoryId: string;
  accountId: string;
  hasPartner: boolean;
  onSave: (data: {
    category_id: string;
    subcategory_id: string;
    account_id: string;
    assigned_to: BudgetAssignment;
    monthly_budget: number;
  }) => void;
}) {
  const themeClasses = useThemeClasses();
  const [budget, setBudget] = useState(subcategory.total_budget);
  const [assignment, setAssignment] = useState<BudgetAssignment>(
    subcategory.user_budget > 0
      ? "user"
      : subcategory.partner_budget > 0
        ? "partner"
        : "both"
  );
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const spentPercent = budget > 0 ? Math.min((subcategory.total_spent / budget) * 100, 100) : 0;
  const remaining = budget - subcategory.total_spent;
  const isOver = remaining < 0;

  const handleSave = () => {
    onSave({
      category_id: categoryId,
      subcategory_id: subcategory.subcategory_id,
      account_id: accountId,
      assigned_to: assignment,
      monthly_budget: budget,
    });
    setIsEditing(false);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const IconComponent = getCategoryIcon(subcategory.subcategory_name);

  return (
    <div className="pl-6 py-3 border-t border-white/5 flex items-center gap-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <IconComponent className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-sm text-slate-300 truncate">
          {subcategory.subcategory_name}
        </span>
      </div>

      <AssignmentToggle
        value={assignment}
        onChange={(v) => {
          setAssignment(v);
          setTimeout(() => handleSave(), 100);
        }}
        hasPartner={hasPartner}
        compact
      />

      <div className="flex items-center gap-2 w-32">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <span className="text-slate-500">$</span>
            <Input
              ref={inputRef}
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) || 0)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-20 h-7 text-sm bg-slate-800/50 border-slate-700"
            />
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded transition-all"
          >
            <span className="text-sm font-medium text-white">
              ${budget.toLocaleString()}
            </span>
            <Edit3 className="w-3 h-3 text-slate-500" />
          </button>
        )}
      </div>

      <div className="w-24 text-right">
        <span
          className={cn(
            "text-sm font-medium",
            isOver ? "text-red-400" : "text-emerald-400"
          )}
        >
          {isOver ? "-" : ""}${Math.abs(remaining).toLocaleString()}
        </span>
      </div>
    </div>
  );
});

// Category budget card
const CategoryBudgetCard = memo(function CategoryBudgetCard({
  category,
  hasPartner,
  onSave,
}: {
  category: BudgetCategoryView;
  hasPartner: boolean;
  onSave: (data: {
    category_id: string;
    subcategory_id?: string | null;
    account_id: string;
    assigned_to: BudgetAssignment;
    monthly_budget: number;
  }) => void;
}) {
  const themeClasses = useThemeClasses();
  const [localBudget, setLocalBudget] = useState(category.total_budget);
  const [assignment, setAssignment] = useState<BudgetAssignment>(
    category.user_budget > 0
      ? "user"
      : category.partner_budget > 0
        ? "partner"
        : "both"
  );
  const [isEditingManual, setIsEditingManual] = useState(false);
  const [manualInput, setManualInput] = useState(category.total_budget.toString());
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalBudget(category.total_budget);
    setManualInput(category.total_budget.toString());
  }, [category.total_budget]);

  useEffect(() => {
    if (isEditingManual && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingManual]);

  const spentPercentage = useMemo(() => {
    if (localBudget === 0) return 0;
    return Math.min((category.total_spent / localBudget) * 100, 100);
  }, [category.total_spent, localBudget]);

  const remaining = localBudget - category.total_spent;
  const isOverBudget = remaining < 0;
  const isNearLimit = spentPercentage >= 80 && !isOverBudget;
  const hasSubcategories = category.subcategories && category.subcategories.length > 0;

  const handleSliderChange = (value: number[]) => {
    setLocalBudget(value[0]);
    setManualInput(value[0].toString());
  };

  const handleSliderCommit = (value: number[]) => {
    onSave({
      category_id: category.category_id,
      subcategory_id: null,
      account_id: category.account_id,
      assigned_to: assignment,
      monthly_budget: value[0],
    });
  };

  const handleManualInputBlur = () => {
    const numValue = parseInt(manualInput, 10) || 0;
    const clampedValue = Math.min(Math.max(numValue, 0), 10000);
    setLocalBudget(clampedValue);
    setManualInput(clampedValue.toString());
    onSave({
      category_id: category.category_id,
      subcategory_id: null,
      account_id: category.account_id,
      assigned_to: assignment,
      monthly_budget: clampedValue,
    });
    setIsEditingManual(false);
  };

  const handleAssignmentChange = (newAssignment: BudgetAssignment) => {
    setAssignment(newAssignment);
    onSave({
      category_id: category.category_id,
      subcategory_id: null,
      account_id: category.account_id,
      assigned_to: newAssignment,
      monthly_budget: localBudget,
    });
  };

  const IconComponent = getCategoryIcon(category.category_name);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="group"
    >
      <Card
        className={cn(
          "neo-card transition-all duration-300",
          "hover:shadow-xl hover:-translate-y-1",
          isOverBudget && "ring-2 ring-red-500/30",
          isNearLimit && "ring-2 ring-amber-500/30"
        )}
        style={{
          background: `linear-gradient(135deg, ${category.category_color}08 0%, transparent 50%)`,
        }}
      >
        <div className="p-5">
          {/* Category Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: `${category.category_color}20`,
                  boxShadow: `0 0 20px ${category.category_color}30`,
                  color: category.category_color,
                }}
              >
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <h3
                  className="font-semibold text-base"
                  style={{ color: category.category_color }}
                >
                  {category.category_name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {isOverBudget ? (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      Over budget
                    </span>
                  ) : isNearLimit ? (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      Near limit
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      On track
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Budget Amount Display */}
            <div className="text-right">
              {isEditingManual ? (
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-xl font-bold text-white">$</span>
                  <Input
                    ref={inputRef}
                    type="text"
                    value={manualInput}
                    onChange={(e) =>
                      setManualInput(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    onBlur={handleManualInputBlur}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleManualInputBlur();
                      if (e.key === "Escape") {
                        setManualInput(localBudget.toString());
                        setIsEditingManual(false);
                      }
                    }}
                    className="w-24 h-8 text-xl font-bold text-white bg-slate-800/50 border-white/20 text-right px-2"
                  />
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingManual(true)}
                  className="group flex items-center gap-1.5 hover:bg-white/5 rounded-lg px-2 py-1 -mr-2 transition-all"
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">
                      ${localBudget.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">/mo</span>
                  </div>
                  <Edit3 className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              <p
                className={cn(
                  "text-sm font-medium mt-0.5",
                  isOverBudget ? "text-red-400" : "text-slate-400"
                )}
              >
                ${category.total_spent.toLocaleString()} spent
              </p>
            </div>
          </div>

          {/* Assignment Toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-slate-500">Budget for:</span>
            <AssignmentToggle
              value={assignment}
              onChange={handleAssignmentChange}
              hasPartner={hasPartner}
            />
          </div>

          {/* Spent Progress Bar */}
          <div className="mb-4">
            <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${spentPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                  background: isOverBudget
                    ? "linear-gradient(90deg, #ef4444, #f87171)"
                    : isNearLimit
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : `linear-gradient(90deg, ${category.category_color}, ${category.category_color}cc)`,
                  boxShadow: isOverBudget
                    ? "0 0 15px rgba(239, 68, 68, 0.5)"
                    : isNearLimit
                      ? "0 0 15px rgba(245, 158, 11, 0.5)"
                      : `0 0 15px ${category.category_color}50`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-slate-500">$0</span>
              <span className="text-xs text-slate-500">
                ${(localBudget * 0.5).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">
                ${localBudget.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Budget Slider */}
          <div className="relative">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 w-8">$0</span>
              <div className="flex-1 relative">
                <Slider
                  value={[Math.min(localBudget, 5000)]}
                  min={0}
                  max={5000}
                  step={50}
                  onValueChange={handleSliderChange}
                  onValueCommit={handleSliderCommit}
                  className={cn(
                    "cursor-pointer",
                    "[&_[role=slider]]:h-5 [&_[role=slider]]:w-5",
                    "[&_[role=slider]]:border-2 [&_[role=slider]]:border-white",
                    "[&_[role=slider]]:shadow-[0_0_15px_rgba(255,255,255,0.3)]",
                    "[&_[role=slider]]:transition-transform [&_[role=slider]]:hover:scale-125",
                    "[&_[data-orientation=horizontal]]:h-2"
                  )}
                  style={
                    {
                      "--slider-track-bg": `linear-gradient(90deg, ${category.category_color}50, ${category.category_color})`,
                      "--slider-thumb-bg": category.category_color,
                    } as React.CSSProperties
                  }
                />
              </div>
              <span className="text-xs text-slate-400 w-12 text-right">
                $5,000
              </span>
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-slate-500">Quick set:</span>
              {[100, 250, 500, 1000, 2000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setLocalBudget(preset);
                    setManualInput(preset.toString());
                    onSave({
                      category_id: category.category_id,
                      subcategory_id: null,
                      account_id: category.account_id,
                      assigned_to: assignment,
                      monthly_budget: preset,
                    });
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium transition-all",
                    localBudget === preset
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300"
                  )}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* Remaining Budget */}
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-sm text-slate-400">Remaining</span>
            <span
              className={cn(
                "text-lg font-bold",
                isOverBudget
                  ? "text-red-400"
                  : isNearLimit
                    ? "text-amber-400"
                    : "text-emerald-400"
              )}
            >
              {isOverBudget ? "-" : ""}${Math.abs(remaining).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Subcategory Expansion */}
        {hasSubcategories && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-5 py-3 border-t border-white/5 flex items-center justify-between text-sm text-slate-400 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {category.subcategories!.length} subcategories
              </span>
              <span className="text-xs">Set individual budgets</span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {category.subcategories!.map((sub) => (
                    <SubcategoryBudgetRow
                      key={sub.subcategory_id}
                      subcategory={sub}
                      categoryId={category.category_id}
                      accountId={category.account_id}
                      hasPartner={hasPartner}
                      onSave={onSave}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </Card>
    </motion.div>
  );
});

// Account filter tabs
const AccountTabs = memo(function AccountTabs({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: { id: string; name: string }[];
  selectedAccountId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
          selectedAccountId === null
            ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg"
            : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
        )}
      >
        All Accounts
      </button>
      {accounts.map((acc) => (
        <button
          key={acc.id}
          onClick={() => onSelect(acc.id)}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
            selectedAccountId === acc.id
              ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg"
              : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
          )}
        >
          {acc.name}
        </button>
      ))}
    </div>
  );
});

const WebBudget = memo(function WebBudget() {
  const themeClasses = useThemeClasses();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const currentMonth = format(new Date(), "yyyy-MM");

  const { data, isLoading, error } = useBudgetAllocations(currentMonth, selectedAccountId || undefined);
  const saveMutation = useSaveBudgetAllocation();

  const summary = data?.summary;
  const hasPartner = data?.hasPartner ?? false;
  const accounts = data?.accounts?.filter((a) => a.type === "expense") ?? [];

  const handleSave = (budgetData: {
    category_id: string;
    subcategory_id?: string | null;
    account_id: string;
    assigned_to: BudgetAssignment;
    monthly_budget: number;
  }) => {
    saveMutation.mutate({
      ...budgetData,
      budget_month: null, // Default recurring budget
    });
  };

  const overallSpentPercentage = useMemo(() => {
    if (!summary || summary.total_budget === 0) return 0;
    return Math.min((summary.total_spent / summary.total_budget) * 100, 100);
  }, [summary]);

  return (
    <div className={`min-h-screen ${themeClasses.pageBg} pb-24`}>
      {/* Header */}
      <div
        className={`sticky top-0 z-20 ${themeClasses.headerGradient} backdrop-blur-xl border-b border-white/5`}
      >
        <div className="max-w-7xl mx-auto py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Wallet className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h1
                  className={`text-xl font-bold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`}
                >
                  Monthly Budget
                </h1>
                <p className="text-sm text-slate-400">
                  Set spending limits for each category
                </p>
              </div>
            </div>
            {hasPartner && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Users className="w-4 h-4" />
                <span>Household Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Account Filter Tabs */}
        {accounts.length > 1 && (
          <div className="mb-6">
            <AccountTabs
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelect={setSelectedAccountId}
            />
          </div>
        )}

        {/* Overall Budget Summary */}
        <Card className="neo-card p-6 mb-6 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/20">
                <Wallet className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-violet-300/70 font-medium">
                  Total Budget
                </p>
                <p className="text-2xl font-bold text-violet-300">
                  ${(summary?.total_budget ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <TrendingUp className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-amber-300/70 font-medium">
                  Total Spent
                </p>
                <p className="text-2xl font-bold text-amber-300">
                  ${(summary?.total_spent ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "p-3 rounded-xl",
                  (summary?.total_remaining ?? 0) >= 0
                    ? "bg-emerald-500/20"
                    : "bg-red-500/20"
                )}
              >
                {(summary?.total_remaining ?? 0) >= 0 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    (summary?.total_remaining ?? 0) >= 0
                      ? "text-emerald-300/70"
                      : "text-red-300/70"
                  )}
                >
                  Remaining
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (summary?.total_remaining ?? 0) >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  )}
                >
                  {(summary?.total_remaining ?? 0) < 0 ? "-" : ""}$
                  {Math.abs(summary?.total_remaining ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Partner breakdown if available */}
          {hasPartner && summary && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-cyan-400/70 mb-1">Me</p>
                <p className="text-sm font-medium text-cyan-300">
                  ${summary.user_spent.toLocaleString()} / ${summary.user_budget.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-pink-400/70 mb-1">Partner</p>
                <p className="text-sm font-medium text-pink-300">
                  ${summary.partner_spent.toLocaleString()} / ${summary.partner_budget.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-violet-400/70 mb-1">Shared</p>
                <p className="text-sm font-medium text-violet-300">
                  ${summary.shared_budget.toLocaleString()} budget
                </p>
              </div>
            </div>
          )}

          {/* Overall Progress Bar */}
          <div className="mt-6">
            <div className="h-3 bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${overallSpentPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
                }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              {overallSpentPercentage.toFixed(1)}% of total budget used
            </p>
          </div>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-400">Loading budget data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="neo-card p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-400">Failed to load budget data</p>
          </Card>
        )}

        {/* Category Budget Grid */}
        {summary && summary.categories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {summary.categories.map((category) => (
                <CategoryBudgetCard
                  key={category.category_id}
                  category={category}
                  hasPartner={hasPartner}
                  onSave={handleSave}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty State */}
        {summary && summary.categories.length === 0 && (
          <Card className="neo-card p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Categories Yet
            </h3>
            <p className="text-slate-400">
              Add expense accounts and categories to start setting budgets.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
});

export default WebBudget;
