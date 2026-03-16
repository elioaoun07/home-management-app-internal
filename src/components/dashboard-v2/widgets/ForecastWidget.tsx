"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import {
  useExpenseForecast,
  useIncomeForecast,
} from "@/features/analytics/useAnalytics";
import { detectTrend } from "@/lib/utils/forecast";
import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  months: MonthlyAnalytics[] | undefined;
};

export default function ForecastWidget({ months }: Props) {
  const expForecast = useExpenseForecast(months);
  const incForecast = useIncomeForecast(months);

  const { data, expTrend } = useMemo(() => {
    if (!months || months.length < 2) return { data: [], expTrend: null };

    const expTrend = detectTrend(
      months.map((m) => ({ month: m.month, value: m.expense })),
    );

    // Historical data
    const historical = months.map((m) => ({
      name: fmtMonth(m.month),
      expense: m.expense,
      income: m.income,
      isProjected: false,
    }));

    // Projected data — connect from last historical point
    const projected = expForecast.map((f, i) => ({
      name: fmtMonth(f.month),
      projExpense: f.predicted,
      projIncome: incForecast[i]?.predicted || 0,
      expUpper: f.upper,
      expLower: f.lower,
      isProjected: true,
    }));

    // Bridge: duplicate the last historical point as first projected
    if (historical.length > 0 && projected.length > 0) {
      const last = historical[historical.length - 1];
      projected.unshift({
        name: last.name,
        projExpense: last.expense!,
        projIncome: last.income!,
        expUpper: last.expense!,
        expLower: last.expense!,
        isProjected: false,
      });
    }

    return { data: [...historical, ...projected.slice(1)], expTrend };
  }, [months, expForecast, incForecast]);

  if (!months || months.length < 2) {
    return (
      <WidgetCard title="Forecasting">
        <div className="text-center py-8">
          <p className="text-white/40 text-xs">
            Need at least 2 months of data to forecast
          </p>
          <p className="text-white/25 text-[10px] mt-1">Keep logging!</p>
        </div>
      </WidgetCard>
    );
  }

  const nextExpense = expForecast[0];
  const nextIncome = incForecast[0];

  return (
    <WidgetCard
      title="Forecasting"
      subtitle="3-month projection"
      action={
        expTrend && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              expTrend.direction === "down"
                ? "bg-emerald-500/20 text-emerald-400"
                : expTrend.direction === "up"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-white/10 text-white/50"
            }`}
          >
            Expense{" "}
            {expTrend.direction === "down"
              ? "↓"
              : expTrend.direction === "up"
                ? "↑"
                : "→"}{" "}
            {expTrend.direction !== "flat" &&
              `${Math.abs(Math.round(expTrend.monthlyChange))}$/mo`}
          </span>
        )
      }
    >
      <div className="h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtAmt}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Confidence band */}
            <Area
              dataKey="expUpper"
              stroke="none"
              fill="url(#confBand)"
              connectNulls={false}
            />
            {/* Historical lines */}
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            {/* Projected lines */}
            <Line
              type="monotone"
              dataKey="projExpense"
              stroke="#f87171"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="projIncome"
              stroke="#34d399"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast metrics */}
      {nextExpense && nextIncome && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="neo-card rounded-lg p-2 text-center">
            <p className="text-[10px] text-white/40">Next Month Expense</p>
            <p className="text-sm font-bold text-red-400">
              ${Math.round(nextExpense.predicted).toLocaleString()}
            </p>
          </div>
          <div className="neo-card rounded-lg p-2 text-center">
            <p className="text-[10px] text-white/40">Next Month Income</p>
            <p className="text-sm font-bold text-emerald-400">
              ${Math.round(nextIncome.predicted).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4 mt-2">
        <Legend color="#34d399" label="Income" />
        <Legend color="#f87171" label="Expense" />
        <Legend color="#f87171" label="Projected" dashed />
      </div>
    </WidgetCard>
  );
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-0.5 relative" style={{ backgroundColor: color }}>
        {dashed && (
          <div
            className="absolute inset-0 bg-[var(--neo-bg,#0a0a1a)]"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 3px, var(--neo-bg,#0a0a1a) 3px, var(--neo-bg,#0a0a1a) 6px)`,
            }}
          />
        )}
      </div>
      <span className="text-[10px] text-white/50">{label}</span>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
      <p className="text-white/60 mb-1">{label}</p>
      {payload
        .filter((p: any) => p.value != null)
        .map((p: any) => (
          <p
            key={p.dataKey}
            style={{ color: p.stroke || p.fill }}
            className="font-medium"
          >
            {p.dataKey.replace("proj", "Proj. ")}: $
            {Number(p.value).toLocaleString()}
          </p>
        ))}
    </div>
  );
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const ms = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${ms[parseInt(m) - 1]} ${y.slice(2)}`;
}

function fmtAmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}
