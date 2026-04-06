"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

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
    const txCounts = [0, 0, 0, 0, 0, 0, 0];
    const weeksSeen: Set<string>[] = Array.from({ length: 7 }, () => new Set());

    for (const t of transactions) {
      const d = new Date(t.date);
      const day = d.getDay();
      const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`;
      totals[day] += t.amount;
      txCounts[day]++;
      weeksSeen[day].add(weekKey);
    }

    const counts = weeksSeen.map((s) => Math.max(s.size, 1));

    const dayData = DAY_NAMES.map((name, i) => ({
      day: name,
      fullName: DAY_FULL[i],
      dayIndex: i,
      total: totals[i],
      avg: Math.round(totals[i] / counts[i]),
      txCount: txCounts[i],
      isWeekend: i === 0 || i === 6,
    }));

    let peakDay = 0;
    let peakAvg = 0;
    for (let i = 0; i < 7; i++) {
      if (dayData[i].avg > peakAvg) {
        peakDay = i;
        peakAvg = dayData[i].avg;
      }
    }

    return { dayData, peakDay, peakAvg };
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

  const weekdayAvg =
    dayData.filter((d) => !d.isWeekend).reduce((s, d) => s + d.avg, 0) / 5;
  const weekendAvg =
    dayData.filter((d) => d.isWeekend).reduce((s, d) => s + d.avg, 0) / 2;

  return (
    <WidgetCard
      interactive
      title="Spending by Day"
      subtitle={`Peak: ${DAY_FULL[peakDay]} ($${peakAvg} avg)`}
      filterActive={activeWeekdays.length > 0}
    >
      <div className="flex items-start gap-4">
        {/* Radar chart */}
        <div className="flex-1 h-[180px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={dayData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" gridType="polygon" />
              <PolarAngleAxis
                dataKey="day"
                tick={({ x, y, payload }: any) => {
                  const d = dayData.find((dd) => dd.day === payload.value);
                  const isWeekend = d?.isWeekend;
                  const isActive =
                    activeWeekdays.length === 0 ||
                    activeWeekdays.includes(d?.dayIndex ?? -1);
                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={isWeekend ? 600 : 500}
                      fill={
                        !isActive
                          ? "rgba(255,255,255,0.15)"
                          : isWeekend
                            ? "rgb(244,114,182)"
                            : "rgba(255,255,255,0.55)"
                      }
                      style={{ cursor: "pointer" }}
                      onClick={() => onWeekdayClick?.(d?.dayIndex ?? 0)}
                    >
                      {payload.value}
                    </text>
                  );
                }}
              />
              <PolarRadiusAxis
                tick={{ fontSize: 8, fill: "rgba(255,255,255,0.2)" }}
                axisLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Radar
                dataKey="avg"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="#22d3ee"
                fillOpacity={0.15}
                dot={{
                  r: 3,
                  fill: "#22d3ee",
                  stroke: "rgba(0,0,0,0.3)",
                  strokeWidth: 1,
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                      <p className="text-white/80 font-medium">{d.fullName}</p>
                      <p className="text-cyan-400 font-semibold">
                        ${d.avg} avg
                      </p>
                      <p className="text-white/40">
                        {d.txCount} transactions · ${d.total.toLocaleString()}{" "}
                        total
                      </p>
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary stats */}
        <div className="flex flex-col gap-2 pt-2 shrink-0">
          <div className="text-center px-3 py-2 rounded-lg bg-white/[0.03]">
            <p className="text-[10px] text-white/35 mb-0.5">Weekday Avg</p>
            <p className="text-sm font-bold text-cyan-400 tabular-nums">
              ${Math.round(weekdayAvg)}
            </p>
          </div>
          <div className="text-center px-3 py-2 rounded-lg bg-white/[0.03]">
            <p className="text-[10px] text-white/35 mb-0.5">Weekend Avg</p>
            <p
              className="text-sm font-bold tabular-nums"
              style={{
                color: weekendAvg > weekdayAvg * 1.2 ? "#f87171" : "#34d399",
              }}
            >
              ${Math.round(weekendAvg)}
            </p>
          </div>
          <div className="text-center px-3 py-2 rounded-lg bg-white/[0.03]">
            <p className="text-[10px] text-white/35 mb-0.5">Total Txns</p>
            <p className="text-sm font-bold text-white/70 tabular-nums">
              {dayData.reduce((s, d) => s + d.txCount, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Day buttons row for filtering */}
      {onWeekdayClick && (
        <div className="flex gap-1 mt-3 pt-2 border-t border-white/5">
          {dayData.map((d) => {
            const isActive =
              activeWeekdays.length === 0 ||
              activeWeekdays.includes(d.dayIndex);
            return (
              <button
                key={d.dayIndex}
                onClick={() => onWeekdayClick(d.dayIndex)}
                className={cn(
                  "flex-1 py-1 rounded-md text-[10px] font-medium transition-all",
                  isActive
                    ? d.isWeekend
                      ? "bg-pink-500/15 text-pink-400"
                      : "bg-cyan-500/15 text-cyan-400"
                    : "bg-white/[0.03] text-white/20",
                )}
              >
                {d.day}
              </button>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
