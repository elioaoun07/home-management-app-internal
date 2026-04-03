"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import {
  addDays,
  differenceInDays,
  format,
  getDay,
  parseISO,
  startOfWeek,
} from "date-fns";
import { useMemo } from "react";

type Props = {
  transactions: { amount: number; date: string }[];
  startDate: string;
  endDate: string;
  onDateClick?: (date: string) => void;
  activeDateRange?: { start: string; end: string } | null;
};

export default function SpendingHeatmapWidget({
  transactions,
  startDate,
  endDate,
  onDateClick,
  activeDateRange,
}: Props) {
  const { weeks, maxAmount, totalDays, peakDate, weekdayAvg, weekendAvg } = useMemo(() => {
    // Build daily totals map
    const dailyMap: Record<string, number> = {};
    for (const t of transactions) {
      dailyMap[t.date] = (dailyMap[t.date] ?? 0) + t.amount;
    }

    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const totalDays = differenceInDays(end, start) + 1;

    // Build weeks grid (starting from Sunday)
    const weekStart = startOfWeek(start);
    const weeks: { date: string; amount: number; inRange: boolean }[][] = [];
    let currentWeek: { date: string; amount: number; inRange: boolean }[] = [];

    let day = weekStart;
    while (day <= end || currentWeek.length > 0) {
      const dateStr = format(day, "yyyy-MM-dd");
      const inRange = day >= start && day <= end;
      currentWeek.push({
        date: dateStr,
        amount: inRange ? (dailyMap[dateStr] ?? 0) : 0,
        inRange,
      });

      if (getDay(day) === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
        if (day > end) break;
      }
      day = addDays(day, 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const allAmounts = Object.values(dailyMap);
    const maxAmount = allAmounts.length > 0 ? Math.max(...allAmounts) : 0;

    // Peak date
    const peakDate = Object.entries(dailyMap).reduce(
      (best, [date, amt]) => (!best || amt > best.amt ? { date, amt } : best),
      null as { date: string; amt: number } | null,
    );

    // Weekend vs weekday averages
    const weekdayAmts: number[] = [];
    const weekendAmts: number[] = [];
    for (const [dateStr, amt] of Object.entries(dailyMap)) {
      const dow = getDay(parseISO(dateStr));
      if (dow === 0 || dow === 6) weekendAmts.push(amt);
      else weekdayAmts.push(amt);
    }
    const weekdayAvg = weekdayAmts.length > 0 ? weekdayAmts.reduce((s, a) => s + a, 0) / weekdayAmts.length : 0;
    const weekendAvg = weekendAmts.length > 0 ? weekendAmts.reduce((s, a) => s + a, 0) / weekendAmts.length : 0;

    return { weeks, maxAmount, totalDays, peakDate, weekdayAvg, weekendAvg };
  }, [transactions, startDate, endDate]);

  if (totalDays < 7) {
    return (
      <WidgetCard title="Spending Heatmap">
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 7 days of data
        </p>
      </WidgetCard>
    );
  }

  const getIntensity = (amount: number) => {
    if (amount === 0 || maxAmount === 0) return "bg-white/[0.03]";
    const ratio = amount / maxAmount;
    if (ratio > 0.75) return "bg-red-500/70";
    if (ratio > 0.5) return "bg-amber-500/50";
    if (ratio > 0.25) return "bg-cyan-500/40";
    return "bg-cyan-500/20";
  };

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <WidgetCard
      interactive
      title="Spending Heatmap"
      subtitle={`${totalDays} days · Darker = higher spend`}
      filterActive={!!activeDateRange}
    >
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="h-3 w-3 flex items-center justify-center text-[7px] text-white/30"
            >
              {i % 2 === 1 ? label : ""}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-0.5 overflow-x-auto flex-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((cell) => {
                const isActiveRange =
                  activeDateRange &&
                  cell.date >= activeDateRange.start &&
                  cell.date <= activeDateRange.end;
                return (
                  <button
                    key={cell.date}
                    onClick={() => cell.inRange && onDateClick?.(cell.date)}
                    className={cn(
                      "h-3 w-3 rounded-[2px] transition-all",
                      cell.inRange
                        ? getIntensity(cell.amount)
                        : "bg-transparent",
                      cell.inRange && "hover:ring-1 hover:ring-white/30",
                      isActiveRange && "ring-1 ring-cyan-400",
                    )}
                    title={
                      cell.inRange
                        ? `${format(parseISO(cell.date), "MMM d")}: $${cell.amount.toFixed(0)}`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-[9px] text-white/30">Less</span>
        <div className="flex gap-0.5">
          <div className="h-2.5 w-2.5 rounded-[2px] bg-white/[0.03]" />
          <div className="h-2.5 w-2.5 rounded-[2px] bg-cyan-500/20" />
          <div className="h-2.5 w-2.5 rounded-[2px] bg-cyan-500/40" />
          <div className="h-2.5 w-2.5 rounded-[2px] bg-amber-500/50" />
          <div className="h-2.5 w-2.5 rounded-[2px] bg-red-500/70" />
        </div>
        <span className="text-[9px] text-white/30">More</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/5">
        {peakDate && (
          <div className="text-center">
            <p className="text-[9px] text-white/30">Peak Day</p>
            <p className="text-[10px] font-medium text-red-400">
              {format(parseISO(peakDate.date), "MMM d")}
            </p>
            <p className="text-[9px] text-white/30">${Math.round(peakDate.amt)}</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-[9px] text-white/30">Weekday Avg</p>
          <p className="text-[10px] font-medium text-cyan-400">${Math.round(weekdayAvg)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-white/30">Weekend Avg</p>
          <p
            className="text-[10px] font-medium"
            style={{ color: weekendAvg > weekdayAvg * 1.2 ? "#f87171" : "#34d399" }}
          >
            ${Math.round(weekendAvg)}
          </p>
        </div>
      </div>
    </WidgetCard>
  );
}
