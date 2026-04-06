"use client";

import {
  ArrowLeftIcon,
  SparklesIcon,
  ZapIcon,
} from "@/components/icons/FuturisticIcons";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { Card } from "@/components/ui/card";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import {
  getTransactionDisplayAmount,
  getTransactionDisplayDescription,
  type OwnershipFilter,
} from "@/lib/utils/splitBill";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Heart, User, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
  is_owner?: boolean;
  // Split bill fields
  is_collaborator?: boolean;
  split_requested?: boolean;
  collaborator_amount?: number;
  collaborator_description?: string;
  split_completed_at?: string;
};

type Props = {
  category: string;
  categoryColor?: string;
  transactions: Transaction[];
  totalAmount: number;
  ownershipFilter?: OwnershipFilter;
  onBack: () => void;
  onTransactionClick: (tx: Transaction) => void;
};

const OWNERSHIP_OPTIONS: {
  value: OwnershipFilter;
  label: string;
  icon: typeof User;
}[] = [
  { value: "mine", label: "Me", icon: User },
  { value: "both", label: "Both", icon: Users },
  { value: "partner", label: "Partner", icon: Heart },
];

export default function CategoryDetailView({
  category,
  categoryColor,
  transactions,
  totalAmount,
  ownershipFilter: initialOwnership = "both",
  onBack,
  onTransactionClick,
}: Props) {
  const themeClasses = useThemeClasses();

  // Use category color or fallback to theme color
  const iconColor = categoryColor || themeClasses.defaultAccentColor;
  const [isExiting, setIsExiting] = useState(false);
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>(initialOwnership);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null,
  );
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      onBack();
    }, 400);
  };

  const toggleDateCollapse = useCallback((date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  // Apply ownership filter to transactions
  const ownershipFilteredTxs = useMemo(() => {
    if (ownershipFilter === "both") return transactions;
    if (ownershipFilter === "mine")
      return transactions.filter(
        (t) => t.is_owner === true || t.is_collaborator === true,
      );
    return transactions.filter(
      (t) =>
        t.is_owner === false || (t.is_owner === true && !!t.split_completed_at),
    );
  }, [transactions, ownershipFilter]);

  const stats = useMemo(() => {
    const bySubcategory = ownershipFilteredTxs.reduce(
      (acc, t) => {
        const sub = t.subcategory || "Other";
        acc[sub] =
          (acc[sub] || 0) + getTransactionDisplayAmount(t, ownershipFilter);
        return acc;
      },
      {} as Record<string, number>,
    );

    const byAccount = ownershipFilteredTxs.reduce(
      (acc, t) => {
        const acct = t.account_name || "Unknown";
        acc[acct] =
          (acc[acct] || 0) + getTransactionDisplayAmount(t, ownershipFilter);
        return acc;
      },
      {} as Record<string, number>,
    );

    const filteredTotal = ownershipFilteredTxs.reduce(
      (sum, t) => sum + getTransactionDisplayAmount(t, ownershipFilter),
      0,
    );

    // Build subcategory color map from transaction data
    const subcategoryColors: Record<string, string> = {};
    for (const t of ownershipFilteredTxs) {
      const sub = t.subcategory || "Other";
      if (t.subcategory_color && !subcategoryColors[sub]) {
        subcategoryColors[sub] = t.subcategory_color;
      }
    }

    return {
      bySubcategory,
      byAccount,
      subcategoryColors,
      avgTransaction:
        ownershipFilteredTxs.length > 0
          ? filteredTotal / ownershipFilteredTxs.length
          : 0,
      count: ownershipFilteredTxs.length,
      total: filteredTotal,
    };
  }, [ownershipFilteredTxs, ownershipFilter]);

  // Filter transactions by active account & subcategory
  const visibleTransactions = useMemo(() => {
    let txs = ownershipFilteredTxs;
    if (activeAccount)
      txs = txs.filter((t) => (t.account_name || "Unknown") === activeAccount);
    if (activeSubcategory)
      txs = txs.filter((t) => (t.subcategory || "Other") === activeSubcategory);
    return txs;
  }, [ownershipFilteredTxs, activeAccount, activeSubcategory]);

  // Group visible transactions by date
  const groupedByDate = useMemo(() => {
    const sorted = [...visibleTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const groups: { date: string; txs: Transaction[] }[] = [];
    for (const tx of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === tx.date) {
        last.txs.push(tx);
      } else {
        groups.push({ date: tx.date, txs: [tx] });
      }
    }
    return groups;
  }, [visibleTransactions]);

  return (
    <div
      className={cn(
        "min-h-screen bg-bg-dark relative",
        isExiting ? "slide-out-blurred-left" : "slide-in-blurred-right",
      )}
      style={
        {
          "--glow-color": "var(--secondary)",
        } as React.CSSProperties
      }
    >
      {/* Futuristic Background Grid */}
      <div className="fixed inset-0 top-14 opacity-10 pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(var(--secondary) 1px, transparent 1px), linear-gradient(90deg, var(--secondary) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header with Glass Morphism */}
      <div
        className={cn(
          "sticky top-0 z-30 backdrop-blur-xl border-b px-3 py-15 bg-bg-card-custom/90",
          themeClasses.border,
        )}
      >
        <button
          onClick={handleBack}
          className={cn(
            "flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg transition-all duration-300 group shadow-md hover:shadow-lg bg-secondary/10 hover:bg-secondary/20 border",
            themeClasses.text,
            themeClasses.textHover,
            themeClasses.border,
          )}
        >
          <ArrowLeftIcon
            className={cn(
              "w-5 h-5 transition-transform group-hover:-translate-x-1",
              themeClasses.glow,
            )}
          />
          <span className="text-sm font-semibold">Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-4">
          <div
            className="relative p-3 rounded-xl scale-in-center border"
            style={{
              borderColor: categoryColor
                ? `${categoryColor}50`
                : "rgba(6, 182, 212, 0.3)",
              backgroundColor: categoryColor
                ? `${categoryColor}15`
                : "rgba(6, 182, 212, 0.05)",
              boxShadow: categoryColor
                ? `0 0 30px ${categoryColor}40, 0 0 60px ${categoryColor}20, inset 0 0 20px ${categoryColor}10`
                : "0 0 30px rgba(6, 182, 212, 0.2)",
            }}
          >
            {/* Wrapper div to apply color to SVG via currentColor inheritance */}
            <div
              style={{
                color: categoryColor || iconColor,
                filter: categoryColor
                  ? `drop-shadow(0 0 8px ${categoryColor}) drop-shadow(0 0 16px ${categoryColor}80)`
                  : `drop-shadow(0 0 8px ${iconColor})`,
              }}
            >
              {(() => {
                const IconComponent = getCategoryIcon(category);
                return <IconComponent className="w-12 h-12" />;
              })()}
            </div>
            <div
              className="absolute -top-1 -right-1"
              style={{
                color: categoryColor || themeClasses.defaultAccentColor,
                filter: categoryColor
                  ? `drop-shadow(0 0 6px ${categoryColor})`
                  : undefined,
              }}
            >
              <SparklesIcon className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="fade-in-expand">
            <h1 className={cn("text-2xl font-bold text-white mb-1")}>
              {category}
            </h1>
            <p className="text-sm text-[#94a3b8]">
              {stats.count} transaction{stats.count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="relative z-10 p-3 space-y-4 pb-20">
        {/* Ownership Toggle */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1 p-1 rounded-xl neo-card">
            {OWNERSHIP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOwnershipFilter(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  ownershipFilter === opt.value
                    ? `${themeClasses.bgActive} ${themeClasses.textActive}`
                    : "text-slate-400 hover:text-slate-300 hover:bg-white/5",
                )}
              >
                <opt.icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center bg-secondary/5 bg-gradient-to-br from-secondary via-primary to-primary bg-opacity-10",
              themeClasses.border,
            )}
            style={{ animationDelay: "0.1s" }}
          >
            <p className="text-xs mb-1 text-[#94a3b8]">Total Spent</p>
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", themeClasses.text)}>
                <BlurredAmount>${stats.total.toFixed(2)}</BlurredAmount>
              </p>
              <ZapIcon
                className={cn(
                  "w-5 h-5 animate-pulse",
                  themeClasses.text,
                  themeClasses.glow,
                )}
              />
            </div>
          </Card>

          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center bg-primary/5",
              themeClasses.border,
            )}
            style={{ animationDelay: "0.2s" }}
          >
            <p className="text-xs mb-1 text-[#94a3b8]">Avg per Transaction</p>
            <p className="text-2xl font-bold text-white">
              <BlurredAmount>${stats.avgTransaction.toFixed(2)}</BlurredAmount>
            </p>
          </Card>
        </div>

        {/* By Account (moved above subcategory) */}
        <Card
          className={cn(
            "neo-card p-4 border backdrop-blur-sm scale-in-center bg-primary/5",
            themeClasses.border,
          )}
          style={{ animationDelay: "0.3s" }}
        >
          <h3
            className={cn(
              "text-sm font-semibold mb-3 flex items-center gap-2",
              themeClasses.text,
            )}
          >
            <ZapIcon className={cn("w-4 h-4", themeClasses.glow)} />
            By Account
            {activeAccount && (
              <button
                onClick={() => setActiveAccount(null)}
                className="ml-auto text-[10px] text-white/30 hover:text-white/50 transition-colors"
              >
                clear ×
              </button>
            )}
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byAccount)
              .sort((a, b) => b[1] - a[1])
              .map(([acct, amt], index) => {
                const isActive = activeAccount === acct;
                const isDimmed = activeAccount !== null && !isActive;
                return (
                  <div
                    key={acct}
                    onClick={() => setActiveAccount(isActive ? null : acct)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer border fade-in-expand",
                      isActive
                        ? "bg-primary/20 ring-1 ring-white/20 scale-[1.02]"
                        : isDimmed
                          ? "bg-primary/5 opacity-30 grayscale scale-[0.97]"
                          : "bg-primary/10 hover:bg-primary/20 hover:scale-105",
                      themeClasses.border,
                    )}
                    style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                  >
                    <span className="text-sm text-white font-medium">
                      {acct}
                    </span>
                    <span
                      className={cn("text-sm font-bold", themeClasses.text)}
                    >
                      <BlurredAmount blurIntensity="sm">
                        ${amt.toFixed(2)}
                      </BlurredAmount>
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* By Subcategory */}
        {Object.keys(stats.bySubcategory).length > 1 && (
          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center bg-primary/5",
              themeClasses.border,
            )}
            style={{ animationDelay: "0.5s" }}
          >
            <h3
              className={cn(
                "text-sm font-semibold mb-3 flex items-center gap-2",
                themeClasses.text,
              )}
            >
              <SparklesIcon className={cn("w-4 h-4", themeClasses.glow)} />
              By Subcategory
              {activeSubcategory && (
                <button
                  onClick={() => setActiveSubcategory(null)}
                  className="ml-auto text-[10px] text-white/30 hover:text-white/50 transition-colors"
                >
                  clear ×
                </button>
              )}
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.bySubcategory)
                .sort((a, b) => b[1] - a[1])
                .map(([sub, amt], index) => {
                  const isActive = activeSubcategory === sub;
                  const isDimmed = activeSubcategory !== null && !isActive;
                  const subColor = stats.subcategoryColors[sub];
                  return (
                    <div
                      key={sub}
                      onClick={() =>
                        setActiveSubcategory(isActive ? null : sub)
                      }
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer border fade-in-expand",
                        isActive
                          ? "bg-secondary/20 ring-1 ring-white/20 scale-[1.02]"
                          : isDimmed
                            ? "bg-secondary/5 opacity-30 grayscale scale-[0.97]"
                            : "bg-secondary/10 hover:bg-secondary/20 hover:scale-105",
                        themeClasses.border,
                      )}
                      style={{
                        animationDelay: `${0.6 + index * 0.1}s`,
                        ...(isActive && subColor
                          ? { borderColor: `${subColor}60` }
                          : {}),
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {subColor && (
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: subColor }}
                          />
                        )}
                        <span
                          className="text-sm font-medium"
                          style={{ color: subColor || "white" }}
                        >
                          {sub}
                        </span>
                      </div>
                      <span
                        className={cn("text-sm font-bold", themeClasses.text)}
                      >
                        <BlurredAmount blurIntensity="sm">
                          ${amt.toFixed(2)}
                        </BlurredAmount>
                      </span>
                    </div>
                  );
                })}
            </div>
          </Card>
        )}

        {/* All Transactions — grouped by date */}
        <Card
          className={cn(
            "neo-card p-4 border backdrop-blur-sm scale-in-center bg-secondary/5",
            themeClasses.border,
          )}
          style={{ animationDelay: "0.7s" }}
        >
          <h3
            className={cn(
              "text-sm font-semibold mb-3 flex items-center gap-2",
              themeClasses.text,
            )}
          >
            <SparklesIcon
              className={cn("w-4 h-4 animate-pulse", themeClasses.glow)}
            />
            Transactions
            <span className="text-xs text-white/30 font-normal ml-auto">
              {visibleTransactions.length} total
            </span>
          </h3>
          <div className="space-y-3">
            {groupedByDate.map((group) => {
              const isCollapsed = collapsedDates.has(group.date);
              const dateTotal = group.txs.reduce(
                (sum, t) =>
                  sum + getTransactionDisplayAmount(t, ownershipFilter),
                0,
              );
              return (
                <div key={group.date}>
                  {/* Date header */}
                  <button
                    onClick={() => toggleDateCollapse(group.date)}
                    className="w-full flex items-center gap-2 py-1.5 px-1 text-left group/date"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                    )}
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      {format(new Date(group.date), "EEE, MMM d, yyyy")}
                    </span>
                    <span className="text-[10px] text-white/25">
                      {group.txs.length}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold ml-auto tabular-nums",
                        themeClasses.text,
                      )}
                    >
                      <BlurredAmount blurIntensity="sm">
                        ${dateTotal.toFixed(2)}
                      </BlurredAmount>
                    </span>
                  </button>

                  {/* Transactions for this date */}
                  {!isCollapsed && (
                    <div className="space-y-2 mt-1.5">
                      {group.txs.map((tx, index) => {
                        const displayAmount = getTransactionDisplayAmount(
                          tx,
                          ownershipFilter,
                        );
                        const displayDescription =
                          getTransactionDisplayDescription(tx, ownershipFilter);

                        const isPartner =
                          tx.is_owner === false && tx.is_collaborator !== true;
                        const ownerBorderColor = isPartner
                          ? themeClasses.isPink
                            ? "rgba(6, 182, 212, 0.4)"
                            : "rgba(236, 72, 153, 0.4)"
                          : themeClasses.isPink
                            ? "rgba(236, 72, 153, 0.4)"
                            : "rgba(6, 182, 212, 0.4)";
                        const ownerGlowColor = isPartner
                          ? themeClasses.isPink
                            ? "rgba(6, 182, 212, 0.2)"
                            : "rgba(236, 72, 153, 0.2)"
                          : themeClasses.isPink
                            ? "rgba(236, 72, 153, 0.2)"
                            : "rgba(6, 182, 212, 0.2)";
                        const isSplitBoth =
                          tx.split_completed_at && ownershipFilter === "both";

                        return (
                          <div
                            key={tx.id}
                            onClick={() => onTransactionClick(tx)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:scale-105 group bg-primary/5 hover:bg-primary/15 fade-in-expand",
                            )}
                            style={{
                              animationDelay: `${0.05 * index}s`,
                              borderColor: isSplitBoth
                                ? undefined
                                : ownerBorderColor,
                              boxShadow: isSplitBoth
                                ? undefined
                                : `0 0 10px ${ownerGlowColor}`,
                              ...(isSplitBoth
                                ? {
                                    borderImage: `linear-gradient(90deg, rgba(236, 72, 153, 0.6), rgba(6, 182, 212, 0.6)) 1`,
                                    borderStyle: "solid",
                                    borderWidth: "1px",
                                  }
                                : {}),
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium truncate"
                                style={{
                                  color:
                                    tx.subcategory_color ||
                                    stats.subcategoryColors[
                                      tx.subcategory || "Other"
                                    ] ||
                                    "white",
                                }}
                              >
                                {tx.subcategory || category}
                              </p>
                              <div className="flex items-center gap-2 text-xs mt-0.5 text-[#94a3b8]">
                                <span>{tx.account_name}</span>
                              </div>
                              {displayDescription && (
                                <p className="text-[13px] mt-1 text-white/80 leading-snug line-clamp-2">
                                  {displayDescription}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p
                                className={cn(
                                  "text-base font-bold ml-3",
                                  themeClasses.text,
                                )}
                              >
                                <BlurredAmount blurIntensity="sm">
                                  ${displayAmount.toFixed(2)}
                                </BlurredAmount>
                              </p>
                              <div
                                className={cn(
                                  "w-1 h-1 rounded-full transition-all group-hover:w-2 group-hover:h-2",
                                  themeClasses.bgActive,
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {visibleTransactions.length === 0 && (
              <p className="text-xs text-white/30 text-center py-4">
                No transactions match the current filters
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
