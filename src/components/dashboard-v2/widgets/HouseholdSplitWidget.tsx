"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import BlurredAmount from "@/components/ui/BlurredAmount";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  hasPartner: boolean;
};

type ViewTab = "split" | "trend" | "categories";

function fmtMonth(ym: string): string {
  const [, m] = ym.split("-");
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1];
}

export default function HouseholdSplitWidget({ months, hasPartner }: Props) {
  const [tab, setTab] = useState<ViewTab>("split");

  const metrics = useMemo(() => {
    if (!months || months.length === 0 || !hasPartner) return null;

    const current = months[months.length - 1];
    const total = current.myExpense + current.partnerExpense;
    if (total === 0) return null;

    const myPct = (current.myExpense / total) * 100;
    const partnerPct = (current.partnerExpense / total) * 100;

    // Overall history
    const allMyExpense = months.reduce((s, m) => s + m.myExpense, 0);
    const allPartnerExpense = months.reduce((s, m) => s + m.partnerExpense, 0);
    const allTotal = allMyExpense + allPartnerExpense;

    const avgMyPct = allTotal > 0 ? (allMyExpense / allTotal) * 100 : 50;
    const avgPartnerPct = allTotal > 0 ? (allPartnerExpense / allTotal) * 100 : 50;

    // Fairness: deviation from 50/50
    const fairnessDelta = Math.abs(myPct - 50);
    const fairnessScore = Math.round(100 - fairnessDelta * 2);

    // Who's paying more and by how much
    const gap = Math.abs(current.myExpense - current.partnerExpense);
    const payingMore = myPct > 50 ? "You" : "Partner";

    // Trend data for chart
    const trendData = months.slice(-6).map((m) => {
      const t = m.myExpense + m.partnerExpense;
      return {
        name: fmtMonth(m.month),
        myPct: t > 0 ? Math.round((m.myExpense / t) * 100) : 50,
        partnerPct: t > 0 ? Math.round((m.partnerExpense / t) * 100) : 50,
      };
    });

    // Per-category breakdown (approximate from categoryBreakdown)
    // We can't perfectly split per category without per-user data,
    // but we can show the top categories for discussion
    const topCats = [...current.categoryBreakdown]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    return {
      myExpense: current.myExpense,
      partnerExpense: current.partnerExpense,
      myPct,
      partnerPct,
      total,
      avgMyPct,
      avgPartnerPct,
      fairnessScore,
      gap,
      payingMore,
      trendData,
      topCats,
    };
  }, [months, hasPartner]);

  if (!hasPartner) return null;

  if (!metrics) {
    return (
      <WidgetCard title="Household Equity">
        <p className="text-white/40 text-xs text-center py-8">No shared expenses yet</p>
      </WidgetCard>
    );
  }

  const fairnessColor =
    metrics.fairnessScore >= 80 ? "#34d399" : metrics.fairnessScore >= 60 ? "#fbbf24" : "#f87171";

  return (
    <WidgetCard
      title="Household Equity"
      subtitle="Spending fairness analysis"
      action={
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${fairnessColor}20`, color: fairnessColor }}
        >
          {metrics.fairnessScore}% fair
        </span>
      }
    >
      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden border border-white/10 mb-3">
        {(["split", "trend", "categories"] as ViewTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 text-[10px] font-medium capitalize transition-colors ${
              tab === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "split" && (
        <div className="space-y-3">
          {/* Stacked bar */}
          <div className="h-6 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-pink-500/80 transition-all duration-700 flex items-center justify-center"
              style={{ width: `${metrics.myPct}%` }}
            >
              {metrics.myPct > 15 && (
                <span className="text-[10px] text-white font-medium">{metrics.myPct.toFixed(0)}%</span>
              )}
            </div>
            <div
              className="h-full bg-blue-500/80 transition-all duration-700 flex items-center justify-center"
              style={{ width: `${metrics.partnerPct}%` }}
            >
              {metrics.partnerPct > 15 && (
                <span className="text-[10px] text-white font-medium">{metrics.partnerPct.toFixed(0)}%</span>
              )}
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-2">
            <div className="neo-card rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-full bg-pink-500" />
                <span className="text-[10px] text-white/50">You</span>
              </div>
              <BlurredAmount>
                <p className="text-sm font-bold text-pink-400">
                  ${Math.round(metrics.myExpense).toLocaleString()}
                </p>
              </BlurredAmount>
              <p className="text-[9px] text-white/30">{metrics.myPct.toFixed(1)}% of total</p>
            </div>
            <div className="neo-card rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] text-white/50">Partner</span>
              </div>
              <BlurredAmount>
                <p className="text-sm font-bold text-blue-400">
                  ${Math.round(metrics.partnerExpense).toLocaleString()}
                </p>
              </BlurredAmount>
              <p className="text-[9px] text-white/30">{metrics.partnerPct.toFixed(1)}% of total</p>
            </div>
          </div>

          {/* Fairness insight */}
          {metrics.gap > 0 && (
            <div
              className="rounded-xl p-2.5 text-center"
              style={{ backgroundColor: `${fairnessColor}10`, border: `1px solid ${fairnessColor}20` }}
            >
              <p className="text-[10px]" style={{ color: fairnessColor }}>
                {metrics.payingMore} paid ${Math.round(metrics.gap).toLocaleString()} more this month
                {metrics.fairnessScore < 70 && " — consider rebalancing"}
              </p>
            </div>
          )}

          {/* Historical average */}
          <div className="neo-card rounded-lg p-2 text-center">
            <p className="text-[10px] text-white/40">
              Historical avg: You {metrics.avgMyPct.toFixed(0)}% · Partner {metrics.avgPartnerPct.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {tab === "trend" && (
        <div>
          <p className="text-[10px] text-white/40 mb-2 text-center">Your share of spending over 6 months</p>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.trendData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="neo-card rounded-lg px-3 py-2 text-xs border border-white/10">
                        <p className="text-white/60 mb-1">{d.name}</p>
                        <p className="text-pink-400">You: {d.myPct}%</p>
                        <p className="text-blue-400">Partner: {d.partnerPct}%</p>
                      </div>
                    );
                  }}
                />
                {/* 50% reference line */}
                <line
                  x1="0%"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 2"
                />
                <Line
                  type="monotone"
                  dataKey="myPct"
                  stroke="#f472b6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#f472b6" }}
                />
                <Line
                  type="monotone"
                  dataKey="partnerPct"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#60a5fa" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-pink-400 rounded" />
              <span className="text-[9px] text-white/40">You</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-blue-400 rounded" />
              <span className="text-[9px] text-white/40">Partner</span>
            </div>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div>
          <p className="text-[10px] text-white/40 mb-2">Top spending categories this month for discussion</p>
          <div className="space-y-2">
            {metrics.topCats.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-white/70">{cat.name}</span>
                  <span className="text-[10px] text-white/60 font-medium tabular-nums">
                    ${Math.round(cat.amount).toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(cat.amount / metrics.topCats[0].amount) * 100}%`,
                      background: cat.classification === "need"
                        ? "linear-gradient(90deg, rgba(251,191,36,0.6), rgba(251,191,36,0.2))"
                        : cat.classification === "want"
                          ? "linear-gradient(90deg, rgba(244,114,182,0.6), rgba(244,114,182,0.2))"
                          : "linear-gradient(90deg, rgba(148,163,184,0.6), rgba(148,163,184,0.2))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-white/25 mt-3 text-center">
            Per-user category split requires individual transaction tagging
          </p>
        </div>
      )}
    </WidgetCard>
  );
}
