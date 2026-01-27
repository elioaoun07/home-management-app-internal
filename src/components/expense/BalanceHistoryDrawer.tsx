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
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  History,
  Loader2,
  Minus,
  ShoppingCart,
} from "lucide-react";
import { useMemo, useState } from "react";

interface BalanceHistoryDrawerProps {
  accountId: string | undefined;
  accountName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "daily" | "activity" | "archives";

// Format date for display
function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

// Format currency
function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

// Daily summary card - simplified and clear
function DayCard({
  day,
  themeClasses,
}: {
  day: DailySummary;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasActivity =
    day.transaction_count > 0 ||
    day.transfer_in_count > 0 ||
    day.transfer_out_count > 0;

  if (!hasActivity) return null;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        themeClasses.cardBg,
        themeClasses.border,
      )}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex-1 text-left">
          <p className={cn("text-sm font-semibold", themeClasses.text)}>
            {formatDateHeader(day.date)}
          </p>
          <p className={cn("text-xs mt-0.5", themeClasses.textFaint)}>
            {formatCurrency(day.opening_balance)} →{" "}
            {formatCurrency(day.closing_balance)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-bold",
                day.net_change >= 0 ? "text-green-400" : "text-red-400",
              )}
            >
              {day.net_change >= 0 ? "+" : "−"}
              {formatCurrency(day.net_change)}
            </p>
            <div className="flex items-center justify-end gap-2 text-xs mt-0.5">
              {day.transaction_count > 0 && (
                <span className="text-red-400/70">
                  {day.transaction_count} expense
                  {day.transaction_count !== 1 ? "s" : ""}
                </span>
              )}
              {day.transfer_in_count > 0 && (
                <span className="text-green-400/70">
                  +{day.transfer_in_count} in
                </span>
              )}
              {day.transfer_out_count > 0 && (
                <span className="text-orange-400/70">
                  −{day.transfer_out_count} out
                </span>
              )}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "w-5 h-5 transition-transform",
              themeClasses.textFaint,
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className={cn("border-t px-4 pb-4", themeClasses.border)}>
          {/* Opening balance */}
          <div className="py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 text-sm">💰</span>
            </div>
            <div className="flex-1">
              <p className={cn("text-xs", themeClasses.textFaint)}>
                Started the day with
              </p>
              <p className={cn("text-sm font-medium", themeClasses.text)}>
                {formatCurrency(day.opening_balance)}
              </p>
            </div>
          </div>

          {/* Transfers In */}
          {day.transfers_in.map((tr) => (
            <div
              key={tr.id}
              className="py-2 flex items-center gap-3 border-l-2 border-green-500/50 ml-4 pl-4"
            >
              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", themeClasses.text)}>
                  {tr.description || `Transfer from ${tr.from_account}`}
                </p>
                <p className={cn("text-xs", themeClasses.textFaint)}>
                  From {tr.from_account}
                </p>
              </div>
              <p className="text-sm font-medium text-green-400">
                +{formatCurrency(tr.amount)}
              </p>
            </div>
          ))}

          {/* Transfers Out */}
          {day.transfers_out.map((tr) => (
            <div
              key={tr.id}
              className="py-2 flex items-center gap-3 border-l-2 border-orange-500/50 ml-4 pl-4"
            >
              <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", themeClasses.text)}>
                  {tr.description || `Transfer to ${tr.to_account}`}
                </p>
                <p className={cn("text-xs", themeClasses.textFaint)}>
                  To {tr.to_account}
                </p>
              </div>
              <p className="text-sm font-medium text-orange-400">
                −{formatCurrency(tr.amount)}
              </p>
            </div>
          ))}

          {/* Transactions (expenses) */}
          {day.transactions.map((txn) => (
            <div
              key={txn.id}
              className="py-2 flex items-center gap-3 border-l-2 border-red-500/50 ml-4 pl-4"
            >
              <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
                <Minus className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm truncate", themeClasses.text)}>
                  {txn.description || txn.category}
                </p>
                <p className={cn("text-xs", themeClasses.textFaint)}>
                  {txn.category}
                </p>
              </div>
              <p className="text-sm font-medium text-red-400">
                −{formatCurrency(txn.amount)}
              </p>
            </div>
          ))}

          {/* Closing balance */}
          <div className="py-3 mt-2 flex items-center gap-3 border-t border-white/5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-emerald-400 text-sm">✓</span>
            </div>
            <div className="flex-1">
              <p className={cn("text-xs", themeClasses.textFaint)}>
                Ended the day with
              </p>
              <p className={cn("text-sm font-medium", themeClasses.text)}>
                {formatCurrency(day.closing_balance)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Activity entry (transfers, adjustments only)
function ActivityEntry({
  entry,
  themeClasses,
}: {
  entry: BalanceHistoryEntry;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const typeInfo = getChangeTypeInfo(entry.change_type);
  const isPositive = entry.change_amount >= 0;

  const getDescription = () => {
    if (entry.transfer) {
      if (entry.change_type === "transfer_in") {
        return `Transfer from ${entry.transfer.from_account_name || "Unknown"}`;
      }
      return `Transfer to ${entry.transfer.to_account_name || "Unknown"}`;
    }
    if (entry.reason) return entry.reason;
    return typeInfo.label;
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border",
        themeClasses.cardBg,
        themeClasses.border,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-lg",
            isPositive ? "bg-green-500/20" : "bg-red-500/20",
          )}
        >
          <span>{typeInfo.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", themeClasses.text)}>
            {getDescription()}
          </p>
          <p className={cn("text-xs", themeClasses.textFaint)}>
            {format(parseISO(entry.created_at), "h:mm a")} • {typeInfo.label}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-semibold",
              isPositive ? "text-green-400" : "text-red-400",
            )}
          >
            {isPositive ? "+" : "−"}
            {formatCurrency(entry.change_amount)}
          </p>
          <p className={cn("text-xs", themeClasses.textFaint)}>
            → {formatCurrency(entry.new_balance)}
          </p>
        </div>
      </div>

      {entry.is_reconciliation && entry.discrepancy_explanation && (
        <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-start gap-2 text-amber-400 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p>{entry.discrepancy_explanation}</p>
        </div>
      )}
    </div>
  );
}

// Monthly archive card
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
        "rounded-xl border overflow-hidden",
        themeClasses.cardBg,
        themeClasses.border,
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Archive className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <p className={cn("text-sm font-medium", themeClasses.text)}>
              {archive.month_name || formatYearMonth(archive.year_month)}
            </p>
            <p className={cn("text-xs", themeClasses.textFaint)}>
              {archive.total_transaction_count} transactions
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
              {archive.net_change >= 0 ? "+" : "−"}
              {formatCurrency(archive.net_change)}
            </p>
            <p className={cn("text-xs", themeClasses.textFaint)}>
              {formatCurrency(archive.opening_balance)} →{" "}
              {formatCurrency(archive.closing_balance)}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "w-5 h-5 transition-transform",
              themeClasses.textFaint,
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className={cn("px-4 pb-4 pt-0 border-t", themeClasses.border)}>
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
            <div className="p-2 rounded bg-white/5">
              <p className={themeClasses.textFaint}>Total Expenses</p>
              <p className="text-red-400 font-medium">
                −{formatCurrency(archive.total_expenses)}
              </p>
            </div>
            <div className="p-2 rounded bg-white/5">
              <p className={themeClasses.textFaint}>Total Income</p>
              <p className="text-green-400 font-medium">
                +{formatCurrency(archive.total_income)}
              </p>
            </div>
            <div className="p-2 rounded bg-white/5">
              <p className={themeClasses.textFaint}>Transfers In</p>
              <p className="text-blue-400 font-medium">
                +{formatCurrency(archive.total_transfers_in)}
              </p>
            </div>
            <div className="p-2 rounded bg-white/5">
              <p className={themeClasses.textFaint}>Transfers Out</p>
              <p className="text-orange-400 font-medium">
                −{formatCurrency(archive.total_transfers_out)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Group activity entries by date
function groupByDate(
  entries: BalanceHistoryEntry[],
): Record<string, BalanceHistoryEntry[]> {
  return entries.reduce(
    (groups, entry) => {
      const date = entry.effective_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
      return groups;
    },
    {} as Record<string, BalanceHistoryEntry[]>,
  );
}

export default function BalanceHistoryDrawer({
  accountId,
  accountName,
  open,
  onOpenChange,
}: BalanceHistoryDrawerProps) {
  const themeClasses = useThemeClasses();
  const [activeTab, setActiveTab] = useState<TabType>("daily");

  // Fetch data
  const { data: historyData, isLoading: historyLoading } = useBalanceHistory(
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

  // Get current balance (from daily data if available)
  const currentBalance =
    dailyData?.current_balance ?? historyData?.current_balance ?? 0;

  // Group activity entries
  const groupedHistory = useMemo(() => {
    if (!historyData?.history) return {};
    return groupByDate(historyData.history);
  }, [historyData?.history]);

  const sortedActivityDates = useMemo(
    () =>
      Object.keys(groupedHistory).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime(),
      ),
    [groupedHistory],
  );

  const isLoading =
    (activeTab === "daily" && dailyLoading) ||
    (activeTab === "activity" && historyLoading) ||
    (activeTab === "archives" && archivesLoading);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "daily", label: "By Day", icon: <Calendar className="w-4 h-4" /> },
    {
      id: "activity",
      label: "Transfers",
      icon: <History className="w-4 h-4" />,
    },
    { id: "archives", label: "Monthly", icon: <Archive className="w-4 h-4" /> },
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
            <DrawerTitle
              className={cn("text-lg font-semibold", themeClasses.text)}
            >
              Balance History
              {accountName && (
                <span
                  className={cn(
                    "ml-2 text-sm font-normal",
                    themeClasses.textFaint,
                  )}
                >
                  • {accountName}
                </span>
              )}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <XIcon className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </div>

          {/* Current balance */}
          <div className={cn("mt-4 p-4 rounded-xl", themeClasses.bgSurface)}>
            <p
              className={cn(
                "text-xs uppercase tracking-wider",
                themeClasses.textFaint,
              )}
            >
              Current Balance
            </p>
            <p
              className={cn(
                "text-3xl font-bold mt-1",
                `bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent`,
              )}
            >
              {formatCurrency(currentBalance)}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 p-1 rounded-lg bg-white/5">
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
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className={cn("w-8 h-8 animate-spin", themeClasses.textFaint)}
              />
            </div>
          )}

          {/* Daily Tab */}
          {activeTab === "daily" && !dailyLoading && (
            <>
              {!dailyData?.days || dailyData.days.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart
                    className={cn(
                      "w-12 h-12 mx-auto mb-3",
                      themeClasses.textFaint,
                    )}
                  />
                  <p className={cn("text-sm", themeClasses.textFaint)}>
                    No transactions yet
                  </p>
                  <p className={cn("text-xs mt-1", themeClasses.textFaint)}>
                    Your daily spending will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dailyData.days.map((day) => (
                    <DayCard
                      key={day.date}
                      day={day}
                      themeClasses={themeClasses}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && !historyLoading && (
            <>
              {sortedActivityDates.length === 0 ? (
                <div className="text-center py-12">
                  <History
                    className={cn(
                      "w-12 h-12 mx-auto mb-3",
                      themeClasses.textFaint,
                    )}
                  />
                  <p className={cn("text-sm", themeClasses.textFaint)}>
                    No transfers yet
                  </p>
                  <p className={cn("text-xs mt-1", themeClasses.textFaint)}>
                    Transfers and balance adjustments appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedActivityDates.map((date) => (
                    <div key={date}>
                      <p
                        className={cn(
                          "text-xs font-semibold uppercase mb-2",
                          themeClasses.textFaint,
                        )}
                      >
                        {formatDateHeader(date)}
                      </p>
                      <div className="space-y-2">
                        {groupedHistory[date].map((entry) => (
                          <ActivityEntry
                            key={entry.id}
                            entry={entry}
                            themeClasses={themeClasses}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Archives Tab */}
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
                    No archives yet
                  </p>
                  <p className={cn("text-xs mt-1", themeClasses.textFaint)}>
                    Monthly summaries are created at month end
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
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
