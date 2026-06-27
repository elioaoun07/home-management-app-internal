"use client";

// Ephemeral visual translator for a Budget AI spending-analysis report.
// Pure function of one `AnalysisReport` → recharts widgets. No fetching, no
// storage: it just re-draws whatever the chat already returned. Every section
// renders only when it has well-formed data, so a partial/odd report can never
// break the layout.

import type {
  AnalysisCategory,
  AnalysisInsight,
  AnalysisKpi,
  AnalysisRecommendation,
  AnalysisReport,
} from "@/lib/ai/analysisReport";
import { cn } from "@/lib/utils";
import BlurredAmount from "@/components/ui/BlurredAmount";
import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  PrivacyBlurProvider,
  usePrivacyBlur,
} from "@/contexts/PrivacyBlurContext";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lightbulb,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
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

const PALETTE = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#e879f9",
];

type Props = {
  report: AnalysisReport;
  onClose: () => void;
};

// Outer component provides a local blur context so the dashboard blur is
// independent from the global app privacy toggle.
export default function AnalysisDashboard({ report, onClose }: Props) {
  return (
    <PrivacyBlurProvider>
      <DashboardInner report={report} onClose={onClose} />
    </PrivacyBlurProvider>
  );
}

function DashboardInner({ report, onClose }: Props) {
  const tc = useThemeClasses();
  const { isBlurred, toggleBlur } = usePrivacyBlur();

  const kpis = report.kpis ?? [];
  const categories = (report.categoryBreakdown ?? []).filter(
    (c) => c.name && c.amount > 0,
  );
  const trend = (report.trend ?? []).filter((t) => t.period);
  const insights = (report.insights ?? []).filter((i) => i.title || i.detail);
  const recommendations = (report.recommendations ?? []).filter(
    (r) => r.action,
  );

  return (
    // Opaque full-screen takeover (Hard Rule #15 — no glass on floating panels).
    <div className={cn("fixed inset-0 z-[200] flex flex-col", tc.bgPage)}>
      {/* Header (h-14); body is a separate flex child so it never overlaps. */}
      <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-white/10">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white/90 flex items-center gap-2">
            <TrendingUp className={cn("h-4 w-4", tc.text)} />
            Spending Dashboard
          </h2>
          {report.period?.label && (
            <p className="text-[11px] text-white/40 truncate">
              {report.period.label}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleBlur}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title={isBlurred ? "Show amounts" : "Hide amounts"}
            aria-label={isBlurred ? "Show amounts" : "Hide amounts"}
          >
            {isBlurred ? (
              <Eye className="h-5 w-5" />
            ) : (
              <EyeOff className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Back to chat"
            aria-label="Close dashboard"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable, mobile-first single column that widens on larger screens. */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl p-4 space-y-4 pb-24">
          {report.headline && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-sm font-semibold text-white/90 leading-snug">
                {report.headline}
              </p>
            </div>
          )}

          {kpis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {kpis.map((k, i) => (
                <KpiCard key={k.id || i} kpi={k} />
              ))}
            </div>
          )}

          {trend.length >= 2 && <TrendWidget trend={trend} />}

          {categories.length > 0 && <CategoryWidget categories={categories} />}

          {insights.length > 0 && (
            <WidgetCard title="Insights">
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <InsightRow key={i} insight={ins} />
                ))}
              </div>
            </WidgetCard>
          )}

          {recommendations.length > 0 && (
            <WidgetCard title="Recommendations">
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <RecommendationRow key={i} rec={rec} />
                ))}
              </div>
            </WidgetCard>
          )}

          {/* Last-resort empty state — should never appear given the contract. */}
          {kpis.length === 0 &&
            categories.length === 0 &&
            insights.length === 0 &&
            recommendations.length === 0 && (
              <p className="text-center text-white/40 text-sm py-10">
                No structured data to visualize for this answer.
              </p>
            )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────── KPI card ───────────────────────────────────

function KpiCard({ kpi }: { kpi: AnalysisKpi }) {
  const sentiment = sentimentColor(kpi.sentiment);
  const showDelta = typeof kpi.delta === "number" && kpi.delta !== 0;
  const deltaUp = (kpi.delta ?? 0) > 0;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/40 truncate">
        {kpi.label}
      </p>
      <BlurredAmount blurIntensity="sm">
        <p className="text-lg font-bold tabular-nums text-white/90 mt-0.5">
          {formatValue(kpi.value, kpi.unit)}
        </p>
      </BlurredAmount>
      {showDelta && (
        <div className={cn("flex items-center gap-1 mt-0.5 text-[11px]", sentiment)}>
          {deltaUp ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          <span className="tabular-nums">
            {formatDelta(kpi.delta as number, kpi.unit)}
          </span>
          {kpi.deltaLabel && (
            <span className="text-white/30">{kpi.deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────── trend ───────────────────────────────────

function TrendWidget({ trend }: { trend: AnalysisReport["trend"] }) {
  const data = trend.map((t) => ({
    name: shortMonth(t.period),
    income: t.income,
    expense: t.expense,
  }));
  return (
    <WidgetCard title="Income vs Expense" subtitle="Monthly trend">
      <div className="h-[200px] -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="aiInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="aiExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
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
              tickFormatter={compactAmount}
              width={42}
            />
            <Tooltip content={<TrendTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#aiInc)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="expense"
              stroke="#f87171"
              strokeWidth={2}
              fill="url(#aiExp)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-1">
        <LegendDot color="#34d399" label="Income" />
        <LegendDot color="#f87171" label="Expense" />
      </div>
    </WidgetCard>
  );
}

// ───────────────────────────────── category ─────────────────────────────────

function CategoryWidget({ categories }: { categories: AnalysisCategory[] }) {
  const [active, setActive] = useState<number | null>(null);

  const { slices, total } = useMemo(() => {
    const merged = new Map<
      string,
      {
        name: string;
        value: number;
        color?: string | null;
        comment?: string | null;
        deltaWeightedTotal: number;
        deltaWeight: number;
      }
    >();

    for (const c of categories) {
      const name = c.name.trim();
      const key = name.toLocaleLowerCase();
      const existing = merged.get(key);
      const value = Math.max(0, c.amount);
      const delta = typeof c.deltaPct === "number" ? c.deltaPct : null;

      if (existing) {
        existing.value += value;
        existing.color ||= c.color;
        existing.comment ||= c.comment;
        if (delta !== null) {
          existing.deltaWeightedTotal += delta * value;
          existing.deltaWeight += value;
        }
      } else {
        merged.set(key, {
          name,
          value,
          color: c.color,
          comment: c.comment,
          deltaWeightedTotal: delta !== null ? delta * value : 0,
          deltaWeight: delta !== null ? value : 0,
        });
      }
    }

    const all = Array.from(merged.values()).sort((a, b) => b.value - a.value);
    const total = all.reduce((sum, c) => sum + c.value, 0);
    const slices = all.slice(0, 8).map((c, i) => ({
      id: `${slugifyKey(c.name)}-${i}`,
      name: c.name,
      value: c.value,
      percent: total > 0 ? (c.value / total) * 100 : 0,
      color: c.color || PALETTE[i % PALETTE.length],
      comment: c.comment,
      deltaPct:
        c.deltaWeight > 0 ? c.deltaWeightedTotal / c.deltaWeight : undefined,
    }));

    return { slices, total };
  }, [categories]);

  const focus = active !== null ? slices[active] : null;

  return (
    <WidgetCard title="Spending by Category">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                onMouseEnter={(_, idx) => setActive(idx)}
                onMouseLeave={() => setActive(null)}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.id}
                    fill={s.color}
                    opacity={active === null || active === i ? 1 : 0.35}
                  />
                ))}
              </Pie>
              <Tooltip content={<CategoryTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[9px] text-white/40 uppercase tracking-wider">
              {focus ? focus.name : "Total"}
            </p>
            <BlurredAmount blurIntensity="sm">
              <p className="text-sm font-bold text-white/85 tabular-nums">
                {formatValue(focus ? focus.value : total, "currency")}
              </p>
            </BlurredAmount>
            <p className="text-[9px] text-white/30">
              {focus ? `${focus.percent.toFixed(0)}%` : `${slices.length} cats`}
            </p>
          </div>
        </div>

        {/* Legend + comments */}
        <div className="flex-1 min-w-0 w-full space-y-1.5">
          {slices.map((s, i) => (
            <button
              key={s.id}
              className="w-full text-left group"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span
                  className="text-[11px] font-medium truncate flex-1"
                  style={{ color: s.color }}
                >
                  {s.name}
                </span>
                {typeof s.deltaPct === "number" && (
                  <span
                    className={cn(
                      "text-[9px] tabular-nums",
                      s.deltaPct > 0 ? "text-rose-400/80" : "text-emerald-400/80",
                    )}
                  >
                    {s.deltaPct > 0 ? "+" : ""}
                    {s.deltaPct.toFixed(0)}%
                  </span>
                )}
                <BlurredAmount blurIntensity="sm">
                  <span className="text-[11px] font-semibold text-white/70 tabular-nums">
                    {formatValue(s.value, "currency")}
                  </span>
                </BlurredAmount>
                <span className="text-[9px] text-white/30 tabular-nums w-8 text-right">
                  {s.percent.toFixed(0)}%
                </span>
              </div>
              <div className="h-0.5 bg-white/5 rounded-full mt-1 overflow-hidden ml-4">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, s.percent)}%`,
                    backgroundColor: s.color,
                    opacity: active === null || active === i ? 1 : 0.3,
                  }}
                />
              </div>
              {s.comment && (
                <p className="text-[10px] text-white/40 mt-0.5 ml-4 leading-snug">
                  {s.comment}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}

// ──────────────────────────── insights & recommendations ────────────────────────────

function InsightRow({ insight }: { insight: AnalysisInsight }) {
  const meta = INSIGHT_META[insight.type] ?? INSIGHT_META.opportunity;
  const Icon = meta.icon;
  return (
    <div className="flex gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", meta.color)} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white/85 leading-snug">
          {insight.title}
        </p>
        {insight.detail && (
          <p className="text-[11px] text-white/50 leading-snug mt-0.5">
            {insight.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: AnalysisRecommendation }) {
  const chip = PRIORITY_CHIP[rec.priority] ?? PRIORITY_CHIP.medium;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
            chip,
          )}
        >
          {rec.priority}
        </span>
        <p className="text-[13px] font-semibold text-white/85 leading-snug flex-1 min-w-0">
          {rec.action}
        </p>
        {typeof rec.estimatedImpact === "number" && rec.estimatedImpact > 0 && (
          <span className="text-[10px] font-semibold text-emerald-400 tabular-nums shrink-0">
            ~{formatValue(rec.estimatedImpact, "currency")}/mo
          </span>
        )}
      </div>
      {rec.rationale && (
        <p className="text-[11px] text-white/50 leading-snug mt-1">
          {rec.rationale}
        </p>
      )}
    </div>
  );
}

const INSIGHT_META = {
  positive: { icon: CheckCircle2, color: "text-emerald-400" },
  warning: { icon: AlertTriangle, color: "text-amber-400" },
  opportunity: { icon: Lightbulb, color: "text-cyan-400" },
  anomaly: { icon: Search, color: "text-violet-400" },
} as const;

const PRIORITY_CHIP = {
  high: "bg-rose-500/15 text-rose-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-slate-500/15 text-slate-300",
} as const;

// ─────────────────────────────── small helpers ───────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-white/50">{label}</span>
    </div>
  );
}

function sentimentColor(s?: string | null): string {
  if (s === "positive") return "text-emerald-400";
  if (s === "negative") return "text-rose-400";
  return "text-white/40";
}

function formatValue(value: number, unit: string): string {
  if (unit === "percent") {
    return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
  }
  if (unit === "currency") {
    const sign = value < 0 ? "-" : "";
    return `${sign}$${Math.abs(value).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatDelta(value: number, unit: string): string {
  const sign = value > 0 ? "+" : "-";
  if (unit === "percent") return `${sign}${Math.abs(value).toFixed(1)}%`;
  if (unit === "currency")
    return `${sign}$${Math.abs(value).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  return `${sign}${Math.abs(value).toLocaleString("en-US")}`;
}

function compactAmount(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function slugifyKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "category";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  return `${MONTHS[parseInt(m[2], 10) - 1] ?? ym} ${m[1].slice(2)}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs border border-white/10 bg-[#0f1d2e] shadow-lg">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke }} className="font-medium">
          {p.dataKey}: ${Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function CategoryTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0";
  return (
    <div className="rounded-lg px-3 py-2 text-xs border border-white/10 bg-[#0f1d2e] shadow-lg">
      <p style={{ color: p.payload.color }} className="font-semibold mb-0.5">
        {p.name}
      </p>
      <p className="text-white/70">
        ${Number(p.value).toLocaleString()} · {pct}%
      </p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
