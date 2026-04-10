"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
} from "@/components/icons/FuturisticIcons";
import BlurredAmount from "@/components/ui/BlurredAmount";
import { useDeleteTransfer, useTransfers } from "@/features/transfers/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import SwipeableItem from "./SwipeableItem";
import TransferDetailModal from "./TransferDetailModal";

type UserFilter = "all" | "mine" | "partner";

type Props = {
  startDate: string;
  endDate: string;
  currentUserId?: string;
  userFilter?: UserFilter;
};

export default function TransferListView({
  startDate,
  endDate,
  currentUserId,
  userFilter = "all",
}: Props) {
  const themeClasses = useThemeClasses();
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(
    null,
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: rawTransfers = [], isLoading } = useTransfers({
    start: startDate,
    end: endDate,
  });

  const transfers = useMemo(() => {
    if (userFilter === "all") return rawTransfers;
    return rawTransfers.filter((t) =>
      userFilter === "mine" ? t.is_owner : !t.is_owner,
    );
  }, [rawTransfers, userFilter]);

  const isSingleDay = startDate === endDate;

  const dayGroups = useMemo(() => {
    if (isSingleDay) return null;
    const sorted = [...transfers].sort((a, b) => b.date.localeCompare(a.date));
    const map: Record<string, typeof transfers> = {};
    for (const t of sorted) {
      (map[t.date] ??= []).push(t);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [transfers, isSingleDay]);

  const allDayKeys = useMemo(
    () => (dayGroups ? dayGroups.map(([k]) => k) : []),
    [dayGroups],
  );
  const allCollapsed =
    allDayKeys.length > 0 && allDayKeys.every((k) => collapsed.has(k));

  const toggleSection = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllDays = useCallback(() => {
    setCollapsed((prev) => {
      if (allCollapsed) return new Set();
      return new Set(allDayKeys);
    });
  }, [allCollapsed, allDayKeys]);

  const deleteMutation = useDeleteTransfer();

  const selectedTransfer = useMemo(() => {
    if (!selectedTransferId) return null;
    return rawTransfers.find((t) => t.id === selectedTransferId) || null;
  }, [selectedTransferId, rawTransfers]);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Transfer deleted", {
          icon: ToastIcons.delete,
          duration: 4000,
          action: {
            label: "Undo",
            onClick: () => {
              // Undo not yet supported for transfers — toast confirms action
            },
          },
        });
      },
    });
  };

  const handleEdit = (id: string) => {
    setSelectedTransferId(id);
  };

  const handleClick = (id: string) => {
    setSelectedTransferId(id);
  };

  if (isLoading && transfers.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[68px] neo-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <RefreshCw className="w-12 h-12 text-slate-400/40 mb-3 mx-auto" />
        <p className={`text-sm font-medium ${themeClasses.text}`}>
          No transfers
        </p>
        <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
          No transfers found for this period
        </p>
      </div>
    );
  }

  const renderTransferRow = (transfer: (typeof transfers)[0]) => {
    const isOwner = transfer.is_owner;
    const isHousehold = transfer.transfer_type === "household";

    return (
      <SwipeableItem
        key={transfer.id}
        itemId={transfer.id}
        isOwner={isOwner}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClick={handleClick}
      >
        <div
          className={cn("neo-card rounded-xl p-3")}
          style={{
            borderLeft: `4px solid ${isHousehold ? "#a855f7" : "#06b6d4"}`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-sm font-semibold truncate ${themeClasses.text}`}
                >
                  {transfer.from_account_name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400/60 flex-shrink-0" />
                <span
                  className={`text-sm font-semibold truncate ${themeClasses.text}`}
                >
                  {transfer.to_account_name}
                </span>
              </div>
              {transfer.description && (
                <p
                  className={`text-xs truncate ${themeClasses.textMuted} mt-0.5`}
                >
                  {transfer.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400/60">
                <span>
                  {format(new Date(transfer.date + "T00:00:00"), "MMM d")}
                </span>
                <span>·</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                    isHousehold
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-cyan-500/20 text-cyan-300",
                  )}
                >
                  {isHousehold ? "Household" : "Self"}
                </span>
                {transfer.fee_amount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-400">
                      Fee ${transfer.fee_amount.toFixed(0)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <BlurredAmount blurIntensity="sm">
                <p className="text-lg font-bold bg-gradient-to-br from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  ${transfer.amount.toFixed(2)}
                </p>
              </BlurredAmount>
            </div>
          </div>
        </div>
      </SwipeableItem>
    );
  };

  return (
    <>
      <div className="space-y-3">
        {dayGroups && dayGroups.length > 1 ? (
          <>
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
            {dayGroups.map(([dayKey, dayTransfers]) => {
              const dayDate = parseISO(dayKey);
              let dayLabel: string;
              if (isToday(dayDate)) dayLabel = "Today";
              else if (isYesterday(dayDate)) dayLabel = "Yesterday";
              else if (isTomorrow(dayDate)) dayLabel = "Tomorrow";
              else dayLabel = format(dayDate, "EEE, MMM d");
              const dayTotal = dayTransfers.reduce((s, t) => s + t.amount, 0);
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
                      {dayTransfers.length}
                    </span>
                    <div
                      className={`flex-1 h-px ${themeClasses.textMuted} opacity-10 bg-current`}
                    />
                    <BlurredAmount blurIntensity="sm">
                      <span className="text-[10px] font-medium text-cyan-400/70">
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
                      {dayTransfers.map(renderTransferRow)}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div className="space-y-2">{transfers.map(renderTransferRow)}</div>
        )}
      </div>

      {/* Transfer Detail Modal */}
      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransferId(null)}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
