"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { type TransactionWithAccount } from "@/lib/utils/incomeExpense";
import { differenceInDays, format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  transactions: TransactionWithAccount[];
  startDate: string;
  endDate: string;
};

function fmtAmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const ms = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${ms[parseInt(m) - 1]} '${y.slice(2)}`;
}

export default function PeriodTimelineWidget({
  months,
  transactions,
  startDate,
  endDate,
}: Props) {
  const totalDays = useMemo(
    () => differenceInDays(parseISO(endDate), parseISO(startDate)) + 1,
    [startDate, endDate],
  );

  // Monthly view when range > 45 days
  const isMonthlyView = totalDays > 45;
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // ── Monthly data ──────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    if (!months) return [];
    return months
      .filter((m) => m.month >= startDate.slice(0, 7) && m.month <= endDate.slice(0, 7))
      .map((m) => ({
        name: fmtMonth(m.month),
        income: m.income,
        expense: m.expense,
        savings: m.savings,
        net: m.income - m.expense,
      }));
  }, [months, startDate, endDate]);

  // ── Daily data ─────────────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const byDate: Record<string, { income: number; expense: number }> = {};
    for (const t of transactions) {
      const d = t.date;
      if (!byDate[d]) byDate[d] = { income: 0, expense: 0 };
      // naive: positive is expense, but we can't distinguish without accounts here
      // use amount positively — treat all as expense for day view (simplified)
      byDate[d].expense += Number(t.amount);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        name: format(parseISO(date), totalDays <= 14 ? "EEE d" : "d MMM"),
        expense: v.expense,
        income: v.income,
      }));
  }, [transactions, totalDays]);

  const data = isMonthlyView ? monthlyData : dailyData;

  if (!data.length) {
    return (
      <WidgetCard title="Timeline">
        <p className="text-white/40 text-xs text-center py-8">
          No data for this period
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title={isMonthlyView ? "Month-by-Month" : "Daily Timeline"}
      subtitle={isMonthlyView ? "Income vs expense per month" : "Daily spending pattern"}
    >
      {isMonthlyView ? (
        <div className="h-[200px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barGap={2} barCategoryGap="22%">
              <defs>
                <linearGradient id="tlIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="tlExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtAmt}
                width={42}
              />
              <Tooltip content={<MonthlyTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar
                dataKey="income"
                fill="url(#tlIncomeGrad)"
                radius={[3, 3, 0, 0]}
                name="Income"
                onMouseEnter={(_: any, i: number) => setHoveredBar(`income-${i}`)}
                onMouseLeave={() => setHoveredBar(null)}
              />
              <Bar
                dataKey="expense"
                fill="url(#tlExpenseGrad)"
                radius={[3, 3, 0, 0]}
                name="Expense"
                onMouseEnter={(_: any, i: number) => setHoveredBar(`expense-${i}`)}
                onMouseLeave={() => setHoveredBar(null)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[200px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtAmt}
                width={42}
              />
              <Tooltip content={<DailyTooltip />} />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#f87171"
                strokeWidth={2}
                fill="url(#dailyGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#f87171", strokeWidth: 0 }}
                name="Spent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      {isMonthlyView && (
        <div className="flex justify-center gap-4 mt-1.5">
          <Legend color="#34d399" label="Income" />
          <Legend color="#f87171" label="Expense" />
        </div>
      )}

      {/* Monthly summary stats */}
      {isMonthlyView && monthlyData.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/5">
          <div className="text-center">
            <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Avg Income</p>
            <p className="text-xs font-semibold text-emerald-400">
              {fmtAmt(
                monthlyData.reduce((s, m) => s + m.income, 0) / monthlyData.length,
              )}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Avg Expense</p>
            <p className="text-xs font-semibold text-red-400">
              {fmtAmt(
                monthlyData.reduce((s, m) => s + m.expense, 0) / monthlyData.length,
              )}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">Best Month</p>
            <p className="text-xs font-semibold text-cyan-400">
              {monthlyData.length > 0
                ? monthlyData.reduce((best, m) =>
                    m.savings > best.savings ? m : best,
                  ).name
                : "—"}
            </p>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-white/50">{label}</span>
    </div>
  );
}

function MonthlyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p: any) => p.dataKey === "income")?.value ?? 0;
  const expense = payload.find((p: any) => p.dataKey === "expense")?.value ?? 0;
  const net = income - expense;
  return (
    <div className="neo-card rounded-xl px-3.5 py-2.5 text-xs border border-white/10 backdrop-blur-md shadow-lg">
      <p className="text-white/70 font-semibold mb-1.5">{label}</p>
      <p className="text-emerald-400">Income: ${Number(income).toLocaleString()}</p>
      <p className="text-red-400">Expense: ${Number(expense).toLocaleString()}</p>
      <div className="border-t border-white/10 mt-1.5 pt-1.5">
        <p style={{ color: net >= 0 ? "#22d3ee" : "#f97316" }}>
          Net: {net >= 0 ? "+" : ""}${Number(net).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neo-card rounded-xl px-3 py-2 text-xs border border-white/10 backdrop-blur-md">
      <p className="text-white/60 mb-0.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke }} className="font-semibold">
          {p.name}: ${Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}
