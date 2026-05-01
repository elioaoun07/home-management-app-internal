"use client";

import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from "@/components/icons/FuturisticIcons";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { useTheme } from "@/contexts/ThemeContext";
import {
  useDashboardTransactions,
  useDeleteTransaction,
} from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { Mail, Tag } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import SwipeableItem from "./SwipeableItem";

// ─── Component ──────────────────────────────────────────────────────
type UserFilter = "all" | "mine" | "partner";
type GroupMode = "time" | "category";

type Props = {
  startDate: string;
  endDate: string;
  currentUserId?: string;
  userFilter?: UserFilter;
  groupMode?: GroupMode;
  categoryFilters?: string[]; // when provided, use instead of internal state + hide internal UI
};

export default function TransactionListView({
  startDate,
  endDate,
  currentUserId,
  userFilter = "all",
  groupMode = "time",
  categoryFilters: externalCategoryFilters,
}: Props) {
  const themeClasses = useThemeClasses();
  const { theme: currentUserTheme } = useTheme();
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [catSectionOpen, setCatSectionOpen] = useState(false);

  const isExternalCategoryFilter = externalCategoryFilters !== undefined;
  const effectiveCategoryFilters = externalCategoryFilters ?? categoryFilters;

  const { data: rawTransactions = [], isLoading } = useDashboardTransactions({
    startDate,
    endDate,
  });

  const availableCategories = useMemo(() => {
    const seen = new Map<string, string>();
    rawTransactions.forEach((tx) => {
      if (tx.category && !seen.has(tx.category)) {
        seen.set(tx.category, tx.category_color || "#94a3b8");
      }
    });
    return Array.from(seen.entries())
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawTransactions]);

  const transactions = useMemo(() => {
    let filtered = rawTransactions;
    if (userFilter !== "all" && currentUserId) {
      filtered = filtered.filter((tx) => {
        const isOwner =
          tx.is_owner ?? (tx.user_id ? tx.user_id === currentUserId : true);
        return userFilter === "mine" ? isOwner : !isOwner;
      });
    }
    if (effectiveCategoryFilters.length > 0) {
      filtered = filtered.filter(
        (tx) => tx.category && effectiveCategoryFilters.includes(tx.category),
      );
    }
    return filtered;
  }, [rawTransactions, userFilter, currentUserId, effectiveCategoryFilters]);

  const deleteMutation = useDeleteTransaction();

  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null;
    return rawTransactions.find((t) => t.id === selectedTxId) || null;
  }, [selectedTxId, rawTransactions]);

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort((a, b) => {
        const aTime = a.inserted_at ? new Date(a.inserted_at).getTime() : 0;
        const bTime = b.inserted_at ? new Date(b.inserted_at).getTime() : 0;
        return bTime - aTime;
      }),
    [transactions],
  );

  const toggleSection = useCallback((section: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const categoryGroups = useMemo(() => {
    if (groupMode !== "category") return null;
    const map: Record<string, { txs: typeof transactions; color: string }> = {};
    for (const tx of transactions) {
      const cat = tx.category || "Uncategorized";
      if (!map[cat])
        map[cat] = { txs: [], color: tx.category_color || "#94a3b8" };
      map[cat].txs.push(tx);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [transactions, groupMode]);

  const dayGroups = useMemo(() => {
    if (groupMode !== "time") return null;
    const map: Record<string, typeof transactions> = {};
    for (const tx of sortedTransactions) {
      const dayKey = tx.date; // YYYY-MM-DD
      (map[dayKey] ??= []).push(tx);
    }
    // Sort days descending (most recent first)
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [sortedTransactions, groupMode]);

  const isSingleDay = startDate === endDate;

  const allDayKeys = useMemo(
    () => (dayGroups ? dayGroups.map(([k]) => k) : []),
    [dayGroups],
  );
  const allCollapsed =
    allDayKeys.length > 0 && allDayKeys.every((k) => collapsed.has(k));

  const toggleAllDays = useCallback(() => {
    setCollapsed((prev) => {
      if (allCollapsed) return new Set();
      return new Set(allDayKeys);
    });
  }, [allCollapsed, allDayKeys]);

  const handleDelete = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Transaction deleted", {
          icon: ToastIcons.delete,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              // Undo handled by mutation hook's optimistic cache
            },
          },
        });
      },
    });
  };

  const handleEdit = (id: string) => {
    setSelectedTxId(id);
  };

  const handleClick = (id: string) => {
    setSelectedTxId(id);
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[68px] neo-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const categorySubFilter =
    !isExternalCategoryFilter && availableCategories.length > 0 ? (
      <div className="mb-3 neo-card rounded-xl overflow-hidden">
        <button
          onClick={() => setCatSectionOpen((v) => !v)}
          className="flex items-center gap-2 w-full px-3 py-2.5"
        >
          <Tag className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
          <span
            className={cn(
              "text-[11px] font-medium flex-1 text-left",
              themeClasses.textMuted,
            )}
          >
            Categories
          </span>
          {categoryFilters.length > 0 && (
            <span className="text-[10px] neo-gradient text-white px-1.5 py-0.5 rounded-full font-medium leading-none">
              {categoryFilters.length}
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              "w-3 h-3 text-white/20 transition-transform",
              catSectionOpen && "rotate-180",
            )}
            size={12}
          />
        </button>
        {catSectionOpen && (
          <div className="px-3 pb-3 border-t border-white/5 pt-2 flex flex-wrap gap-1.5">
            {availableCategories.map(({ name, color }) => {
              const isSelected = categoryFilters.includes(name);
              return (
                <button
                  key={name}
                  onClick={() =>
                    setCategoryFilters((prev) =>
                      prev.includes(name)
                        ? prev.filter((c) => c !== name)
                        : [...prev, name],
                    )
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${color}20`,
                          color: color,
                          border: `1px solid ${color}45`,
                        }
                      : {
                          backgroundColor: "rgba(255,255,255,0.04)",
                          color: "rgba(255,255,255,0.35)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: isSelected
                        ? color
                        : "rgba(255,255,255,0.2)",
                    }}
                  />
                  {name}
                </button>
              );
            })}
            {categoryFilters.length > 0 && (
              <button
                onClick={() => setCategoryFilters([])}
                className="flex items-center px-2 py-1 rounded-full text-[10px] text-white/30 hover:text-white/50 transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    ) : null;

  const renderTxRow = (tx: (typeof transactions)[0]) => {
    const isOwner =
      tx.is_owner ??
      (currentUserId && tx.user_id ? tx.user_id === currentUserId : true);
    const IconComponent = getCategoryIcon(tx.category || undefined);
    return (
      <SwipeableItem
        key={tx.id}
        itemId={tx.id}
        isOwner={!!isOwner}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClick={handleClick}
      >
        <div
          className={cn(
            "neo-card rounded-xl p-3 relative overflow-hidden",
            tx._isPending && "opacity-70",
          )}
          style={{
            borderLeft:
              tx.split_requested && tx.split_completed_at
                ? undefined
                : `4px solid ${
                    isOwner
                      ? currentUserTheme === "pink"
                        ? "#ec4899"
                        : "#3b82f6"
                      : currentUserTheme === "pink"
                        ? "#3b82f6"
                        : "#ec4899"
                  }`,
          }}
        >
          {tx.split_requested && tx.split_completed_at && (
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(to bottom, #3b82f6 0%, #3b82f6 50%, #ec4899 50%, #ec4899 100%)",
              }}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <IconComponent
                  className={`w-5 h-5 ${themeClasses.labelTextMuted} ${themeClasses.iconGlow} flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: tx.category_color || "#e2e8f0" }}
                  >
                    {tx.category || "Uncategorized"}
                  </p>
                  {tx.description && (
                    <p className={`text-xs truncate ${themeClasses.textMuted}`}>
                      {tx.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400/60">
                <span>{format(new Date(tx.date + "T00:00:00"), "MMM d")}</span>
                {tx.account_name && (
                  <>
                    <span>·</span>
                    <span className="truncate">{tx.account_name}</span>
                  </>
                )}
                {tx.split_requested && tx.split_completed_at && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400">Split</span>
                  </>
                )}
                {tx.debt_id && (
                  <>
                    <span>·</span>
                    <span className="text-orange-400">Debt</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right flex items-center gap-2">
              {tx._isPending && (
                <svg
                  className="w-4 h-4 text-amber-400 animate-spin"
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
              )}
              <BlurredAmount blurIntensity="sm">
                <p className="text-lg font-bold bg-gradient-to-br from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                  ${tx.amount.toFixed(2)}
                </p>
              </BlurredAmount>
            </div>
          </div>
        </div>
      </SwipeableItem>
    );
  };

  if (transactions.length === 0) {
    return (
      <>
        {categorySubFilter}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Mail className="w-12 h-12 text-slate-400/40 mb-3 mx-auto" />
          <p className={`text-sm font-medium ${themeClasses.text}`}>
            No transactions
          </p>
          <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
            No transactions found for this period
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {categorySubFilter}
      <div className="space-y-3">
        {groupMode === "category" && categoryGroups ? (
          categoryGroups.map(([catName, { txs, color }]) => {
            const isCollapsed = collapsed.has(catName);
            return (
              <div key={catName}>
                <button
                  onClick={() => toggleSection(catName)}
                  className="flex items-center gap-2 w-full px-1 py-1.5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="text-[11px] font-medium tracking-wide uppercase"
                    style={{ color }}
                  >
                    {catName}
                  </span>
                  <span
                    className={`text-[10px] ${themeClasses.textMuted} opacity-50`}
                  >
                    {txs.length}
                  </span>
                  <div
                    className={`flex-1 h-px ${themeClasses.textMuted} opacity-10 bg-current`}
                  />
                  {isCollapsed ? (
                    <ChevronDownIcon
                      className={`w-3 h-3 ${themeClasses.textMuted} opacity-50`}
                      size={12}
                    />
                  ) : (
                    <ChevronUpIcon
                      className={`w-3 h-3 ${themeClasses.textMuted} opacity-50`}
                      size={12}
                    />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {txs.map((tx) => renderTxRow(tx))}
                  </div>
                )}
              </div>
            );
          })
        ) : isSingleDay ? (
          <div className="space-y-2">
            {sortedTransactions.map((tx) => renderTxRow(tx))}
          </div>
        ) : dayGroups ? (
          <>
            {/* Collapse/Expand All */}
            {dayGroups.length > 1 && (
              <button
                onClick={toggleAllDays}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ml-auto",
                  themeClasses.textMuted,
                  "hover:bg-white/5",
                )}
              >
                {allCollapsed ? (
                  <>
                    <ChevronDownIcon className="w-3 h-3" />
                    Expand all
                  </>
                ) : (
                  <>
                    <ChevronUpIcon className="w-3 h-3" />
                    Collapse all
                  </>
                )}
              </button>
            )}
            {dayGroups.map(([dayKey, txs]) => {
              const dayDate = parseISO(dayKey);
              let dayLabel: string;
              if (isToday(dayDate)) dayLabel = "Today";
              else if (isYesterday(dayDate)) dayLabel = "Yesterday";
              else if (isTomorrow(dayDate)) dayLabel = "Tomorrow";
              else dayLabel = format(dayDate, "EEE, MMM d");
              const dayTotal = txs.reduce((s, t) => s + t.amount, 0);
              const isDayCollapsed = collapsed.has(dayKey);
              return (
                <div key={dayKey}>
                  <button
                    onClick={() => toggleSection(dayKey)}
                    className="flex items-center gap-2 w-full px-1 py-1.5"
                  >
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wider",
                        isToday(dayDate)
                          ? themeClasses.textActive
                          : themeClasses.textMuted,
                      )}
                    >
                      {dayLabel}
                    </span>
                    <span
                      className={`text-[10px] ${themeClasses.textMuted} opacity-50`}
                    >
                      {txs.length}
                    </span>
                    <div
                      className={`flex-1 h-px ${themeClasses.textMuted} opacity-10 bg-current`}
                    />
                    <BlurredAmount blurIntensity="sm">
                      <span className="text-[10px] font-medium text-emerald-400/70">
                        ${dayTotal.toFixed(2)}
                      </span>
                    </BlurredAmount>
                    {isDayCollapsed ? (
                      <ChevronDownIcon
                        className={`w-3 h-3 ${themeClasses.textMuted} opacity-50`}
                        size={12}
                      />
                    ) : (
                      <ChevronUpIcon
                        className={`w-3 h-3 ${themeClasses.textMuted} opacity-50`}
                        size={12}
                      />
                    )}
                  </button>
                  {!isDayCollapsed && (
                    <div className="space-y-2">
                      {txs.map((tx) => renderTxRow(tx))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div className="space-y-2">
            {sortedTransactions.map((tx) => renderTxRow(tx))}
          </div>
        )}
      </div>

      {selectedTx && (
        <TransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTxId(null)}
          onSave={() => setSelectedTxId(null)}
          onDelete={() => setSelectedTxId(null)}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
