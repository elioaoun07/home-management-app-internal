"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type Transaction = {
  amount: number;
  date: string;
};

type Props = {
  transactions: Transaction[];
  activeWeekdays?: number[];
  onWeekdayClick?: (day: number) => void;
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function DayOfWeekWidget({
  transactions,
  activeWeekdays = [],
  onWeekdayClick,
}: Props) {
  const { dayData, peakDay, peakAvg } = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const txCounts = [0, 0, 0, 0, 0, 0, 0];

    // Track unique weeks per day to compute proper averages
    const weeksSeen: Set<string>[] = Array.from({ length: 7 }, () => new Set());

    for (const t of transactions) {
      const d = new Date(t.date);
      const day = d.getDay();
      const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`;
      totals[day] += t.amount;
      txCounts[day]++;
      weeksSeen[day].add(weekKey);
    }

    for (let i = 0; i < 7; i++) {
      counts[i] = Math.max(weeksSeen[i].size, 1);
    }

    const dayData = DAY_NAMES.map((name, i) => ({
      name,
      fullName: DAY_FULL[i],
      dayIndex: i,
      total: totals[i],
      avg: totals[i] / counts[i],
      txCount: txCounts[i],
    }));

    const maxAvg = Math.max(...dayData.map((d) => d.avg));
    let peakDay = 0;
    let peakAvg = 0;
    for (let i = 0; i < 7; i++) {
      if (dayData[i].avg > peakAvg) {
        peakDay = i;
        peakAvg = dayData[i].avg;
      }
    }

    return { dayData, maxAvg, peakDay, peakAvg };
  }, [transactions]);

  if (transactions.length < 7) {
    return (
      <WidgetCard title="Spending by Day">
        <p className="text-white/40 text-xs text-center py-8">
          Not enough data (need at least 7 transactions)
        </p>
      </WidgetCard>
    );
  }

  const max = Math.max(...dayData.map((d) => d.avg));

  return (
    <WidgetCard
      interactive
      title="Spending by Day"
      subtitle={`Peak: ${DAY_FULL[peakDay]} ($${peakAvg.toFixed(0)} avg)`}
      filterActive={activeWeekdays.length > 0}
    >
      <div className="flex items-end gap-1.5 h-28">
        {dayData.map((d) => {
          const isActive =
            activeWeekdays.length === 0 || activeWeekdays.includes(d.dayIndex);
          const isWeekend = d.dayIndex === 0 || d.dayIndex === 6;
          const heightPct = max > 0 ? (d.avg / max) * 100 : 0;

          return (
            <button
              key={d.dayIndex}
              onClick={() => onWeekdayClick?.(d.dayIndex)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 transition-opacity",
                !isActive && "opacity-25",
              )}
            >
              <span className="text-[9px] text-white/50 tabular-nums">
                ${d.avg.toFixed(0)}
              </span>
              <div className="w-full flex justify-center">
                <div
                  className={cn(
                    "w-full max-w-[28px] rounded-t transition-all duration-500",
                    isWeekend ? "bg-pink-500/50" : "bg-cyan-500/50",
                    activeWeekdays.includes(d.dayIndex) &&
                      (isWeekend ? "bg-pink-500/80" : "bg-cyan-500/80"),
                  )}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isWeekend ? "text-pink-400/70" : "text-white/50",
                )}
              >
                {d.name}
              </span>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
