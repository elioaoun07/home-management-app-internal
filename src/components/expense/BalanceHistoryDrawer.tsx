"use client";

import { XIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  formatYearMonth,
  getNetChangeColor,
  useBalanceArchives,
  useDailySummaries,
  type BalanceArchive,
  type DailySummary,
} from "@/features/balance/archiveHooks";
import {
  formatChangeAmount,
  getChangeTypeInfo,
  useBalanceHistory,
  type BalanceHistoryEntry,
} from "@/features/balance/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import {
  AlertTriangle,
  Archive,
  Calendar,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

interface BalanceHistoryDrawerProps {
  accountId: string | undefined;
  accountName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "activity" | "daily" | "archives";

// Group history entries by date
function groupByDate(
  entries: BalanceHistoryEntry[],
): Record<string, BalanceHistoryEntry[]> {
  return entries.reduce(
    (groups, entry) => {
      const date = entry.effective_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
      return groups;
    },
    {} as Record<string, BalanceHistoryEntry[]>,
  );
}

// Format date for display
function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

// Single history entry component
function HistoryEntry({
  entry,
  themeClasses,
}: {
  entry: BalanceHistoryEntry;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const typeInfo = getChangeTypeInfo(entry.change_type);
  const isPositive = entry.change_amount >= 0;

  // Get description based on change type
  const getDescription = () => {
    if (entry.transaction) {
      return (
        entry.transaction.description ||
        entry.transaction.category ||
        "Transaction"
      );
    }
    if (entry.transfer) {
      if (entry.change_type === "transfer_in") {
        return `From: ${entry.transfer.from_account_name || "Unknown"}`;
      }
      return `To: ${entry.transfer.to_account_name || "Unknown"}`;
    }
    if (entry.reason) {
      return entry.reason;
    }
    return typeInfo.label;
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        themeClasses.cardBg,
        themeClasses.border,
      )}
    >
      {/* Main row */}
      <div className="flex items-start justify-between gap-3">
        {/* Icon and details */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg",
              isPositive ? "bg-green-500/20" : "bg-red-500/20",
            )}
          >
            <span>{typeInfo.icon}</span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isPositive ? "text-green-400" : "text-red-400",
                )}
              >
                {formatChangeAmount(entry.change_amount)}
              </span>
              <span className={cn("text-xs", themeClasses.textFaint)}>
                {format(parseISO(entry.created_at), "h:mm a")}
              </span>
            </div>
            <p className={cn("text-sm truncate", themeClasses.text)}>
              {getDescription()}
            </p>
            <p className={cn("text-xs", themeClasses.textFaint)}>
              {typeInfo.label}
            </p>
          </div>
        </div>

        {/* Balance change */}
        <div className="text-right flex-shrink-0">
          <p className={cn("text-xs", themeClasses.textFaint)}>Balance</p>
          <p className={cn("text-sm font-medium", themeClasses.text)}>
            ${entry.new_balance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Reconciliation warning */}
      {entry.is_reconciliation && (
        <div className="mt-2 pt-2 border-t border-amber-500/20">
          <div className="flex items-start gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium">Reconciliation Adjustment</p>
              {entry.discrepancy_amount !== null && (
                <p className="opacity-80">
                  Discrepancy: {formatChangeAmount(entry.discrepancy_amount)}
                </p>
              )}
              {entry.discrepancy_explanation && (
                <p className="opacity-80 mt-1">
                  {entry.discrepancy_explanation}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer details */}
      {entry.transfer && entry.transfer.description && (
        <div className={cn("mt-2 pt-2 border-t", themeClasses.border)}>
          <p className={cn("text-xs", themeClasses.textFaint)}>
            Note: {entry.transfer.description}
          </p>
        </div>
      )}
    </div>
  );
}

// Daily summary card component
function DailySummaryCard({
  summary,
  themeClasses,
}: {
  summary: DailySummary;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const [expanded, setExpanded] = useState(false);
  const netPositive = summary.net_transactions >= 0;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        themeClasses.cardBg,
        themeClasses.border,
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
              netPositive ? "bg-green-500/20" : "bg-red-500/20",
            )}
          >
            {netPositive ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={cn("text-sm font-medium", themeClasses.text)}>
              {formatDateHeader(summary.summary_date)}
            </p>
            <p className={cn("text-xs", themeClasses.textFaint)}>
              {summary.transaction_count} transaction
              {summary.transaction_count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-semibold",
                netPositive ? "text-green-400" : "text-red-400",
              )}
            >
              {netPositive ? "+" : ""}${summary.net_transactions.toFixed(2)}
            </p>
            <div className="flex gap-2 text-xs">
              {summary.total_income > 0 && (
                <span className="text-green-400/70">
                  +${summary.total_income.toFixed(0)}
                </span>
              )}
              {summary.total_expenses > 0 && (
                <span className="text-red-400/70">
                  -${summary.total_expenses.toFixed(0)}
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              themeClasses.textFaint,
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className={cn("px-3 pb-3 pt-0 border-t", themeClasses.border)}>
          {summary.category_breakdown &&
            summary.category_breakdown.length > 0 && (
              <div className="mt-3 space-y-2">
                <p
                  className={cn("text-xs font-medium", themeClasses.textFaint)}
                >
                  By Category
                </p>
                {summary.category_breakdown.map((cat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className={themeClasses.text}>
                        {cat.name} ({cat.count})
                      </span>
                    </div>
                    <span
                      className={cn(
                        cat.amount >= 0 ? "text-green-400" : "text-red-400",
                      )}
                    >
                      {cat.amount >= 0 ? "+" : ""}${cat.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

          {(summary.largest_income || summary.largest_expense) && (
            <div className="mt-3 pt-2 border-t border-white/5">
              <p
                className={cn(
                  "text-xs font-medium mb-2",
                  themeClasses.textFaint,
                )}
              >
                Highlights
              </p>
              <div className="space-y-1 text-xs">
                {summary.largest_income && (
                  <div className="flex justify-between">
                    <span className={themeClasses.textFaint}>
                      Largest in: {summary.largest_income_desc}
                    </span>
                    <span className="text-green-400">
                      +${summary.largest_income.toFixed(2)}
                    </span>
                  </div>
                )}
                {summary.largest_expense && (
                  <div className="flex justify-between">
                    <span className={themeClasses.textFaint}>
                      Largest out: {summary.largest_expense_desc}
                    </span>
                    <span className="text-red-400">
                      -${summary.largest_expense.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Monthly archive card component
function ArchiveCard({
  archive,
  themeClasses,
}: {
  archive: BalanceArchive;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border transition-all",
        themeClasses.cardBg,
        themeClasses.border,
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-purple-500/20">
            <Archive className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className={cn("text-sm font-medium", themeClasses.text)}>
              {formatYearMonth(archive.year_month)}
            </p>
            <p className={cn("text-xs", themeClasses.textFaint)}>
              {archive.total_transaction_count} txns • {archive.transfer_count}{" "}
              transfers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-semibold",
                getNetChangeColor(archive.net_change),
              )}
            >
              {archive.net_change >= 0 ? "+" : ""}$
              {archive.net_change.toFixed(2)}
            </p>
            <p className={cn("text-xs", themeClasses.textFaint)}>
              ${archive.closing_balance.toFixed(0)}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              themeClasses.textFaint,
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className={cn("px-3 pb-3 pt-0 border-t", themeClasses.border)}>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className={themeClasses.textFaint}>Opening</p>
              <p className={themeClasses.text}>
                ${archive.opening_balance.toFixed(2)}
              </p>
            </div>
            <div>
              <p className={themeClasses.textFaint}>Closing</p>
              <p className={themeClasses.text}>
                ${archive.closing_balance.toFixed(2)}
              </p>
            </div>
            <div>
              <p className={themeClasses.textFaint}>Income</p>
              <p className="text-green-400">
                +${archive.total_income.toFixed(2)}
              </p>
            </div>
            <div>
              <p className={themeClasses.textFaint}>Expenses</p>
              <p className="text-red-400">
                -${archive.total_expenses.toFixed(2)}
              </p>
            </div>
            <div>
              <p className={themeClasses.textFaint}>Transfers In</p>
              <p className="text-blue-400">
                +${archive.total_transfers_in.toFixed(2)}
              </p>
            </div>
            <div>
              <p className={themeClasses.textFaint}>Transfers Out</p>
              <p className="text-orange-400">
                -${archive.total_transfers_out.toFixed(2)}
              </p>
            </div>
          </div>
          {archive.adjustment_count > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5 text-xs">
              <p className={themeClasses.textFaint}>
                {archive.adjustment_count} adjustment
                {archive.adjustment_count !== 1 ? "s" : ""}:
                <span className={getNetChangeColor(archive.total_adjustments)}>
                  {" "}
                  {archive.total_adjustments >= 0 ? "+" : ""}$
                  {archive.total_adjustments.toFixed(2)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BalanceHistoryDrawer({
  accountId,
  accountName,
  open,
  onOpenChange,
}: BalanceHistoryDrawerProps) {
  const themeClasses = useThemeClasses();
  const [activeTab, setActiveTab] = useState<TabType>("activity");

  // Fetch data based on active tab
  const {
    data: historyData,
    isLoading: historyLoading,
    error,
  } = useBalanceHistory(
    open && activeTab === "activity" ? accountId : undefined,
    { limit: 100 },
  );

  const { data: dailyData, isLoading: dailyLoading } = useDailySummaries(
    open && activeTab === "daily" ? accountId : undefined,
    { limit: 30 },
  );

  const { data: archivesData, isLoading: archivesLoading } = useBalanceArchives(
    open && activeTab === "archives" ? accountId : undefined,
  );

  // Group history entries by date
  const groupedHistory = useMemo(() => {
    if (!historyData?.history) return {};
    return groupByDate(historyData.history);
  }, [historyData?.history]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedHistory).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );
  }, [groupedHistory]);

  const isLoading =
    (activeTab === "activity" && historyLoading) ||
    (activeTab === "daily" && dailyLoading) ||
    (activeTab === "archives" && archivesLoading);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: "activity",
      label: "Activity",
      icon: <History className="w-4 h-4" />,
    },
    { id: "daily", label: "Daily", icon: <Calendar className="w-4 h-4" /> },
    {
      id: "archives",
      label: "Archives",
      icon: <Archive className="w-4 h-4" />,
    },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "max-h-[85vh] rounded-t-2xl",
          themeClasses.surfaceBg,
          themeClasses.border,
        )}
      >
        <DrawerHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className={cn("w-5 h-5", themeClasses.textHighlight)} />
              <DrawerTitle className={cn("text-lg", themeClasses.text)}>
                Balance History
                {accountName && (
                  <span className={cn("ml-2 text-sm", themeClasses.textFaint)}>
                    - {accountName}
                  </span>
                )}
              </DrawerTitle>
            </div>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", themeClasses.bgHover)}
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </div>

          {/* Current balance summary */}
          {historyData && (
            <div className={cn("mt-3 p-3 rounded-lg", themeClasses.bgSurface)}>
              <p className={cn("text-xs", themeClasses.textFaint)}>
                Current Balance
              </p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  `bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`,
                )}
              >
                ${historyData.current_balance.toFixed(2)}
              </p>
            </div>
          )}

          {/* Tab navigation */}
          <div className="flex gap-1 mt-3 p-1 rounded-lg bg-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-white/10 text-white"
                    : cn(themeClasses.textFaint, "hover:bg-white/5"),
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto flex-1 px-4 py-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className={cn("w-8 h-8 animate-spin", themeClasses.textFaint)}
              />
            </div>
          )}

          {/* Error state */}
          {error && activeTab === "activity" && (
            <div className="text-center py-12">
              <p className="text-red-400 text-sm">
                {error instanceof Error
                  ? error.message
                  : "Failed to load history"}
              </p>
            </div>
          )}

          {/* Activity Tab - Transfers & Adjustments only */}
          {activeTab === "activity" && !historyLoading && !error && (
            <>
              {sortedDates.length === 0 ? (
                <div className="text-center py-12">
                  <History
                    className={cn(
                      "w-12 h-12 mx-auto mb-3",
                      themeClasses.textFaint,
                    )}
                  />
                  <p className={cn("text-sm", themeClasses.textFaint)}>
                    No transfers or adjustments yet
                  </p>
                  <p className={cn("text-xs mt-1", themeClasses.textFaint)}>
                    Transfers and manual balance changes appear here
                  </p>
                </div>
              ) : (
                sortedDates.map((date) => (
                  <div key={date} className="mb-6">
                    <h3
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider mb-3 sticky top-0 py-1",
                        themeClasses.textFaint,
                        themeClasses.surfaceBg,
                      )}
                    >
                      {formatDateHeader(date)}
                    </h3>
                    <div className="space-y-2">
                      {groupedHistory[date].map((entry) => (
                        <HistoryEntry
                          key={entry.id}
                          entry={entry}
                          themeClasses={themeClasses}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}

              {historyData?.pagination.has_more && (
                <div className="text-center py-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={themeClasses.bgHover}
                  >
                    Load More
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Daily Tab - Transaction Summaries */}
          {activeTab === "daily" && !dailyLoading && (
            <>
              {!dailyData || dailyData.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar
                    className={cn(
                      "w-12 h-12 mx-auto mb-3",
                      themeClasses.textFaint,
                    )}
                  />
                  <p className={cn("text-sm", themeClasses.textFaint)}>
                    No daily summaries yet
                  </p>
                  <p className={cn("text-xs mt-1", themeClasses.textFaint)}>
                    Add transactions to see daily activity
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dailyData.map((summary) => (
                    <DailySummaryCard
                      key={summary.id}
                      summary={summary}
                      themeClasses={themeClasses}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Archives Tab - Monthly Summaries */}
          {activeTab === "archives" && !archivesLoading && (
            <>
              {!archivesData || archivesData.length === 0 ? (
                <div className="text-center py-12">
                  <Archive
                    className={cn(
                      "w-12 h-12 mx-auto mb-3",
                      themeClasses.textFaint,
                    )}
                  />
                  <p className={cn("text-sm", themeClasses.textFaint)}>
                    No monthly archives yet
                  </p>
                  <p className={cn("text-xs mt-1", themeClasses.textFaint)}>
                    Monthly archives are created automatically at month end
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivesData.map((archive) => (
                    <ArchiveCard
                      key={archive.id}
                      archive={archive}
                      themeClasses={themeClasses}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
