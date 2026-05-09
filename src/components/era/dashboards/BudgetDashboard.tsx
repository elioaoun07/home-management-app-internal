"use client";

// ERA Budget Dashboard — MTD spend, trend chart, category breakdown, recent transactions.

import { eraKeys } from "@/features/era/queryKeys";
import { CACHE_TIMES, getCachedPreferences } from "@/lib/queryConfig";
import { safeFetch } from "@/lib/safeFetch";
import { getDefaultDateRange } from "@/lib/utils/date";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EraStatCard } from "./EraStatCard";

const HUE = 175;
const LINE_COLOR = `hsl(${HUE}, 72%, 62%)`;
const AREA_FILL = `hsl(${HUE}, 72%, 62%)`;

interface Transaction {
  amount: number;
  date: string;
  category?: { name: string } | null;
  user_id: string;
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function useMonthTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ["era", "dashboard", "budget"],
    queryFn: async () => {
      const prefs = getCachedPreferences();
      const day = Number(prefs?.date_start?.split("-")[1] ?? "1") || 1;
      const { start, end } = getDefaultDateRange(day);
      const res = await safeFetch(
        `/api/transactions?start=${start}&end=${end}`,
        { timeoutMs: 10_000 },
      );
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: CACHE_TIMES.TRANSACTIONS,
  });
}

function buildDailyData(transactions: Transaction[]) {
  const byDay: Record<string, number> = {};
  if (!Array.isArray(transactions)) return [];
  for (const t of transactions) {
    const day = t.date?.slice(0, 10) ?? "";
    if (!day) continue;
    byDay[day] = (byDay[day] ?? 0) + t.amount;
  }
  const sorted = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  let cum = 0;
  return sorted.map(([date, amount]) => {
    cum += amount;
    return {
      day: date.slice(8),
      amount: +amount.toFixed(2),
      cumulative: +cum.toFixed(2),
    };
  });
}

function buildCategoryData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    const name = t.category?.name ?? "Other";
    map[name] = (map[name] ?? 0) + t.amount;
  }
  const sorted = Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const rest = Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(6)
    .reduce((s, [, v]) => s + v, 0);
  if (rest > 0) sorted.push(["Other", rest]);
  return sorted.map(([name, value]) => ({ name, value: +value.toFixed(2) }));
}

const PIE_COLORS = [
  HUE,
  HUE + 35,
  HUE + 70,
  HUE - 35,
  HUE - 70,
  HUE + 110,
  HUE - 110,
].map((h) => `hsl(${((h % 360) + 360) % 360}, 65%, 60%)`);

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { day: string } }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs text-white/80"
      style={{
        background: `hsla(${HUE}, 20%, 8%, 0.95)`,
        border: `1px solid hsla(${HUE}, 50%, 40%, 0.3)`,
        backdropFilter: "blur(12px)",
      }}
    >
      <p className="font-semibold" style={{ color: LINE_COLOR }}>
        {fmt(payload[0]?.value ?? 0)}
      </p>
      <p className="text-white/40">Day {payload[0]?.payload?.day}</p>
    </div>
  );
}

export function BudgetDashboard() {
  const { data: rawTransactions, isLoading } = useMonthTransactions();
  const transactions: Transaction[] = Array.isArray(rawTransactions)
    ? rawTransactions
    : [];
  // Gate Recharts + date-sensitive values to client-only to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const dailyData = useMemo(() => buildDailyData(transactions), [transactions]);
  const catData = useMemo(
    () => buildCategoryData(transactions),
    [transactions],
  );
  const total = useMemo(
    () => transactions.reduce((s, t) => s + t.amount, 0),
    [transactions],
  );
  const topCat = catData[0];
  const dailyAvg = useMemo(() => {
    if (!mounted) return 0;
    const today = new Date().getDate();
    return today > 0 ? total / today : 0;
  }, [total, mounted]);

  return (
    <div className="flex flex-col gap-4 px-4 py-3 pb-6">
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        <EraStatCard
          hue={HUE}
          label="This period"
          value={isLoading ? "…" : fmt(total)}
          sub="month-to-date"
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Top category"
          value={topCat?.name ?? "—"}
          sub={topCat ? fmt(topCat.value) : undefined}
          loading={isLoading}
        />
        <EraStatCard
          hue={HUE}
          label="Daily average"
          value={mounted && !isLoading ? fmt(dailyAvg) : "…"}
          sub="per day"
          loading={isLoading}
        />
      </div>

      {/* Spending trend */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: `hsla(${HUE}, 18%, 7%, 0.82)`,
          border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
          backdropFilter: "blur(14px)",
        }}
      >
        <p
          className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
          style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
        >
          Cumulative spend — this period
        </p>
        {!mounted || isLoading ? (
          <div className="h-36 animate-pulse rounded-xl bg-white/5" />
        ) : dailyData.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-xs text-white/30">
            No transactions this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={148}>
            <AreaChart
              data={dailyData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="era-budget-grad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={AREA_FILL} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={AREA_FILL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: LINE_COLOR,
                  strokeOpacity: 0.3,
                  strokeWidth: 1,
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={LINE_COLOR}
                strokeWidth={1.8}
                fill="url(#era-budget-grad)"
                dot={false}
                activeDot={{ r: 4, fill: LINE_COLOR, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row: category donut + recent transactions */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Category breakdown */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: `hsla(${HUE}, 18%, 7%, 0.82)`,
            border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
            backdropFilter: "blur(14px)",
          }}
        >
          <p
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
          >
            By category
          </p>
          {!mounted || isLoading ? (
            <div className="h-36 animate-pulse rounded-xl bg-white/5" />
          ) : catData.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-xs text-white/30">
              No data
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={110} height={110}>
                <Pie
                  data={catData}
                  cx={50}
                  cy={50}
                  innerRadius={32}
                  outerRadius={52}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {catData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
              <ul className="flex flex-col gap-1.5 overflow-hidden">
                {catData.slice(0, 5).map((c, i) => (
                  <li key={c.name} className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate text-[11px] text-white/55">
                      {c.name}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] text-white/35">
                      {fmt(c.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: `hsla(${HUE}, 18%, 7%, 0.82)`,
            border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
            backdropFilter: "blur(14px)",
          }}
        >
          <p
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
          >
            Recent
          </p>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-7 animate-pulse rounded-lg bg-white/5"
                />
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {transactions.slice(0, 6).map((t, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: LINE_COLOR }}
                  />
                  <span className="flex-1 truncate text-xs text-white/55">
                    {t.category?.name ?? "Uncategorized"}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-white/70">
                    ${t.amount.toFixed(2)}
                  </span>
                  <span className="shrink-0 text-[10px] text-white/30">
                    {t.date?.slice(5)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
