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
  Edit3,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

type CategoryBudget = {
  id: string;
  name: string;
  icon?: string;
  color: string;
  budget: number;
  spent: number;
};

type Props = {
  categories: CategoryBudget[];
  onBudgetChange?: (categoryId: string, newBudget: number) => void;
};

// Fancy slider component with gradient track and manual input
const BudgetSlider = memo(function BudgetSlider({
  category,
  onBudgetChange,
}: {
  category: CategoryBudget;
  onBudgetChange?: (categoryId: string, newBudget: number) => void;
}) {
  const themeClasses = useThemeClasses();
  const [localBudget, setLocalBudget] = useState(category.budget);
  const [isEditingManual, setIsEditingManual] = useState(false);
  const [manualInput, setManualInput] = useState(category.budget.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local budget when category prop changes
  useEffect(() => {
    setLocalBudget(category.budget);
    setManualInput(category.budget.toString());
  }, [category.budget]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingManual && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingManual]);

  const spentPercentage = useMemo(() => {
    if (localBudget === 0) return 0;
    return Math.min((category.spent / localBudget) * 100, 100);
  }, [category.spent, localBudget]);

  const remaining = localBudget - category.spent;
  const isOverBudget = remaining < 0;
  const isNearLimit = spentPercentage >= 80 && !isOverBudget;

  const handleSliderChange = (value: number[]) => {
    setLocalBudget(value[0]);
    setManualInput(value[0].toString());
  };

  const handleSliderCommit = (value: number[]) => {
    onBudgetChange?.(category.id, value[0]);
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setManualInput(value);
  };

  const handleManualInputBlur = () => {
    const numValue = parseInt(manualInput, 10) || 0;
    const clampedValue = Math.min(Math.max(numValue, 0), 10000);
    setLocalBudget(clampedValue);
    setManualInput(clampedValue.toString());
    onBudgetChange?.(category.id, clampedValue);
    setIsEditingManual(false);
  };

  const handleManualInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      handleManualInputBlur();
    } else if (e.key === "Escape") {
      setManualInput(localBudget.toString());
      setIsEditingManual(false);
    }
  };

  const IconComponent = getCategoryIcon(category.name);

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
          "neo-card p-5 transition-all duration-300",
          "hover:shadow-xl hover:-translate-y-1",
          isOverBudget && "ring-2 ring-red-500/30",
          isNearLimit && "ring-2 ring-amber-500/30"
        )}
        style={{
          background: `linear-gradient(135deg, ${category.color}08 0%, transparent 50%)`,
        }}
      >
        {/* Category Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl transition-transform group-hover:scale-110"
              style={{
                backgroundColor: `${category.color}20`,
                boxShadow: `0 0 20px ${category.color}30`,
                color: category.color,
              }}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3
                className="font-semibold text-base"
                style={{ color: category.color }}
              >
                {category.name}
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

          {/* Budget Amount Display - Clickable to edit */}
          <div className="text-right">
            {isEditingManual ? (
              <div className="flex items-center gap-1 justify-end">
                <span className="text-xl font-bold text-white">$</span>
                <Input
                  ref={inputRef}
                  type="text"
                  value={manualInput}
                  onChange={handleManualInputChange}
                  onBlur={handleManualInputBlur}
                  onKeyDown={handleManualInputKeyDown}
                  className="w-24 h-8 text-xl font-bold text-white bg-slate-800/50 border-white/20 text-right px-2"
                  placeholder="0"
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
              ${category.spent.toLocaleString()} spent
            </p>
          </div>
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
                    : `linear-gradient(90deg, ${category.color}, ${category.color}cc)`,
                boxShadow: isOverBudget
                  ? "0 0 15px rgba(239, 68, 68, 0.5)"
                  : isNearLimit
                    ? "0 0 15px rgba(245, 158, 11, 0.5)"
                    : `0 0 15px ${category.color}50`,
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
                    "--slider-track-bg": `linear-gradient(90deg, ${category.color}50, ${category.color})`,
                    "--slider-thumb-bg": category.color,
                  } as React.CSSProperties
                }
              />
              {/* Slider glow effect */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none opacity-50 blur-sm"
                style={{
                  background: `linear-gradient(90deg, transparent, ${category.color}40 ${(Math.min(localBudget, 5000) / 5000) * 100}%, transparent ${(Math.min(localBudget, 5000) / 5000) * 100}%)`,
                }}
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
                  onBudgetChange?.(category.id, preset);
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
      </Card>
    </motion.div>
  );
});

const WebBudget = memo(function WebBudget({
  categories,
  onBudgetChange,
}: Props) {
  const themeClasses = useThemeClasses();

  // Calculate totals
  const totals = useMemo(() => {
    const totalBudget = categories.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    return { totalBudget, totalSpent, totalRemaining };
  }, [categories]);

  const overallSpentPercentage = useMemo(() => {
    if (totals.totalBudget === 0) return 0;
    return Math.min((totals.totalSpent / totals.totalBudget) * 100, 100);
  }, [totals]);

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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
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
                  ${totals.totalBudget.toLocaleString()}
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
                  ${totals.totalSpent.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "p-3 rounded-xl",
                  totals.totalRemaining >= 0
                    ? "bg-emerald-500/20"
                    : "bg-red-500/20"
                )}
              >
                {totals.totalRemaining >= 0 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                )}
              </div>
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    totals.totalRemaining >= 0
                      ? "text-emerald-300/70"
                      : "text-red-300/70"
                  )}
                >
                  Remaining
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    totals.totalRemaining >= 0
                      ? "text-emerald-300"
                      : "text-red-300"
                  )}
                >
                  {totals.totalRemaining < 0 ? "-" : ""}$
                  {Math.abs(totals.totalRemaining).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

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

        {/* Category Budget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {categories.map((category, index) => (
              <BudgetSlider
                key={category.id}
                category={category}
                onBudgetChange={onBudgetChange}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {categories.length === 0 && (
          <Card className="neo-card p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Categories Yet
            </h3>
            <p className="text-slate-400">
              Your categories will appear here once you start tracking expenses.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
});

export default WebBudget;
