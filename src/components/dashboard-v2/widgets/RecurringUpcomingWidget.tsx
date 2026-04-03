"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useRecurringPayments } from "@/features/recurring/useRecurringPayments";
import { cn } from "@/lib/utils";
import {
  addDays,
  differenceInDays,
  format,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import { useMemo, useState } from "react";

type Props = {
  onAccountClick?: (account: string) => void;
};

type Horizon = 7 | 14 | 30;

export default function RecurringUpcomingWidget({ onAccountClick }: Props) {
  const { data: payments } = useRecurringPayments();
  const [horizon, setHorizon] = useState<Horizon>(14);

  const upcoming = useMemo(() => {
    if (!payments) return [];
    const now = new Date();
    const cutoff = addDays(now, horizon);

    return payments
      .filter((p) => {
        if (!p.is_active || !p.next_due_date) return false;
        const due = parseISO(p.next_due_date);
        return (
          (isAfter(due, now) ||
            format(due, "yyyy-MM-dd") === format(now, "yyyy-MM-dd")) &&
          isBefore(due, cutoff)
        );
      })
      .sort(
        (a, b) =>
          parseISO(a.next_due_date).getTime() -
          parseISO(b.next_due_date).getTime(),
      )
      .map((p) => {
        const due = parseISO(p.next_due_date);
        const daysUntil = differenceInDays(due, now);
        return {
          id: p.id,
          name: p.name,
          amount: p.amount,
          dueDate: p.next_due_date,
          daysUntil,
          accountName: p.account?.name ?? "Unknown",
          categoryName: p.category?.name,
          categoryColor: p.category?.color,
          recurrenceType: p.recurrence_type,
          isUrgent: daysUntil <= 3,
        };
      });
  }, [payments, horizon]);

  const totalDue = useMemo(
    () => upcoming.reduce((s, p) => s + p.amount, 0),
    [upcoming],
  );

  return (
    <WidgetCard
      title="Upcoming Recurring"
      subtitle={`${upcoming.length} payments in next ${horizon} days · $${totalDue.toFixed(0)} total`}
      action={
        <div className="flex gap-0.5 rounded-md bg-white/5 p-0.5">
          {([7, 14, 30] as Horizon[]).map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                horizon === h
                  ? "bg-white/10 text-white"
                  : "text-white/30 hover:text-white/50",
              )}
            >
              {h}d
            </button>
          ))}
        </div>
      }
    >
      {upcoming.length === 0 ? (
        <p className="text-white/30 text-xs text-center py-6">
          No payments due in the next {horizon} days
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
          {upcoming.map((p) => (
            <button
              key={p.id}
              onClick={() => onAccountClick?.(p.accountName)}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors text-left"
            >
              {/* Urgency indicator */}
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  p.isUrgent ? "bg-red-400 animate-pulse" : "bg-white/20",
                )}
              />

              {/* Details */}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/80 font-medium truncate">
                  {p.name}
                </p>
                <p className="text-[10px] text-white/30 truncate">
                  {p.accountName}
                  {p.categoryName && ` · ${p.categoryName}`}
                </p>
              </div>

              {/* Due + amount */}
              <div className="text-right shrink-0">
                <p className="text-xs text-white/70 font-medium tabular-nums">
                  ${p.amount.toFixed(0)}
                </p>
                <p
                  className={cn(
                    "text-[10px] tabular-nums",
                    p.isUrgent ? "text-red-400" : "text-white/30",
                  )}
                >
                  {p.daysUntil === 0
                    ? "Today"
                    : p.daysUntil === 1
                      ? "Tomorrow"
                      : `in ${p.daysUntil}d`}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
