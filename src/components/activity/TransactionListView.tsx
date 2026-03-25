"use client";

import TransactionDetailModal from "@/components/dashboard/TransactionDetailModal";
import {
  ChevronDownIcon,
  ChevronUpIcon,
} from "@/components/icons/FuturisticIcons";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { useTheme } from "@/contexts/ThemeContext";
import {
  type Transaction,
  useDashboardTransactions,
  useDeleteTransaction,
} from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { format } from "date-fns";
import { Mail, Moon, Sun } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import SwipeableItem from "./SwipeableItem";

// ─── Time-of-day grouping ───────────────────────────────────────────
type TimeOfDay = "morning" | "afternoon" | "evening";

const TIME_SECTIONS: { key: TimeOfDay; label: string; icon: ReactNode }[] = [
  { key: "morning", label: "Morning", icon: <Sun className="w-3.5 h-3.5 text-yellow-400" /> },
  { key: "afternoon", label: "Afternoon", icon: <Sun className="w-3.5 h-3.5 text-orange-400" /> },
  { key: "evening", label: "Evening", icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
];

function getTimeOfDay(insertedAt: string | undefined): TimeOfDay {
  if (!insertedAt) return "afternoon"; // safe fallback
  const hour = new Date(insertedAt).getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening"; // 18-23, 0-4
}

function groupByTimeOfDay(
  txs: Transaction[],
): Record<TimeOfDay, Transaction[]> {
  const groups: Record<TimeOfDay, Transaction[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  for (const tx of txs) {
    groups[getTimeOfDay(tx.inserted_at)].push(tx);
  }
  return groups;
}

// ─── Component ──────────────────────────────────────────────────────
type UserFilter = "all" | "mine" | "partner";

type Props = {
  startDate: string;
  endDate: string;
  currentUserId?: string;
  userFilter?: UserFilter;
};

export default function TransactionListView({
  startDate,
  endDate,
  currentUserId,
  userFilter = "all",
}: Props) {
  const themeClasses = useThemeClasses();
  const { theme: currentUserTheme } = useTheme();
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TimeOfDay>>(new Set());

  const { data: rawTransactions = [], isLoading } = useDashboardTransactions({
    startDate,
    endDate,
  });

  const transactions = useMemo(() => {
    if (userFilter === "all" || !currentUserId) return rawTransactions;
    return rawTransactions.filter((tx) => {
      const isOwner =
        tx.is_owner ?? (tx.user_id ? tx.user_id === currentUserId : true);
      return userFilter === "mine" ? isOwner : !isOwner;
    });
  }, [rawTransactions, userFilter, currentUserId]);

  const deleteMutation = useDeleteTransaction();

  const selectedTx = useMemo(() => {
    if (!selectedTxId) return null;
    return rawTransactions.find((t) => t.id === selectedTxId) || null;
  }, [selectedTxId, rawTransactions]);

  const timeGroups = useMemo(
    () => groupByTimeOfDay(transactions),
    [transactions],
  );

  const toggleSection = useCallback((section: TimeOfDay) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

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

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Mail className="w-12 h-12 text-slate-400/40 mb-3 mx-auto" />
        <p className={`text-sm font-medium ${themeClasses.text}`}>
          No transactions
        </p>
        <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
          No transactions found for this period
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {TIME_SECTIONS.map(({ key, label, icon }) => {
          const sectionTxs = timeGroups[key];
          if (sectionTxs.length === 0) return null;
          const isCollapsed = collapsed.has(key);

          return (
            <div key={key}>
              {/* Section header — minimal divider style */}
              <button
                onClick={() => toggleSection(key)}
                className="flex items-center gap-2 w-full px-1 py-1.5 group"
              >
                <span className="flex items-center">{icon}</span>
                <span
                  className={`text-[11px] font-medium tracking-wide uppercase ${themeClasses.textMuted}`}
                >
                  {label}
                </span>
                <span
                  className={`text-[10px] ${themeClasses.textMuted} opacity-50`}
                >
                  {sectionTxs.length}
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

              {/* Section body */}
              {!isCollapsed && (
                <div className="space-y-2">
                  {sectionTxs.map((tx) => {
                    const isOwner =
                      tx.is_owner ??
                      (currentUserId && tx.user_id
                        ? tx.user_id === currentUserId
                        : true);

                    const IconComponent = getCategoryIcon(
                      tx.category || undefined,
                    );

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
                            "neo-card rounded-xl p-3",
                            tx._isPending && "opacity-70",
                          )}
                          style={{
                            borderLeft: `4px solid ${
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
                          <div className="flex items-center justify-between gap-3">
                            {/* Left: Icon + Category */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <IconComponent
                                  className={`w-5 h-5 ${themeClasses.labelTextMuted} ${themeClasses.iconGlow} flex-shrink-0`}
                                />
                                <div className="flex-1 min-w-0">
                                  <p
                                    className="text-sm font-semibold truncate"
                                    style={{
                                      color: tx.category_color || "#e2e8f0",
                                    }}
                                  >
                                    {tx.category || "Uncategorized"}
                                  </p>
                                  {tx.description && (
                                    <p
                                      className={`text-xs truncate ${themeClasses.textMuted}`}
                                    >
                                      {tx.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {/* Date + Account */}
                              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400/60">
                                <span>
                                  {format(
                                    new Date(tx.date + "T00:00:00"),
                                    "MMM d",
                                  )}
                                </span>
                                {tx.account_name && (
                                  <>
                                    <span>·</span>
                                    <span className="truncate">
                                      {tx.account_name}
                                    </span>
                                  </>
                                )}
                                {tx.split_requested &&
                                  tx.split_completed_at && (
                                    <>
                                      <span>·</span>
                                      <span className="text-emerald-400">
                                        Split
                                      </span>
                                    </>
                                  )}
                                {tx.debt_id && (
                                  <>
                                    <span>·</span>
                                    <span className="text-orange-400">
                                      Debt
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Right: Amount */}
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
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Transaction Detail Modal */}
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
