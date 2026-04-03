"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { MonthlyAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import {
  detectCategoryAnomalies,
  type AnomalySeverity,
} from "@/lib/utils/anomalyDetection";
import { format, parse } from "date-fns";
import { AlertTriangle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";

type Props = {
  months: MonthlyAnalytics[] | undefined;
  onCategoryClick?: (category: string) => void;
};

const severityConfig: Record<
  AnomalySeverity,
  { color: string; bg: string; icon: typeof AlertTriangle }
> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10", icon: AlertTriangle },
  warning: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    icon: AlertTriangle,
  },
  info: { color: "text-cyan-400", bg: "bg-cyan-500/10", icon: Info },
};

export default function AnomalyDetectionWidget({
  months,
  onCategoryClick,
}: Props) {
  const { report, currentMonthLabel, historyCount } = useMemo(() => {
    if (!months || months.length < 4) return { report: null, currentMonthLabel: "", historyCount: 0 };

    const r = detectCategoryAnomalies(
      months.map((m) => ({
        month: m.month,
        categoryBreakdown: m.categoryBreakdown.map((c) => ({
          name: c.name,
          amount: c.amount,
        })),
      })),
    );

    const lastMonth = months[months.length - 1].month;
    let label = lastMonth;
    try {
      label = format(parse(lastMonth, "yyyy-MM", new Date()), "MMMM yyyy");
    } catch {}

    return { report: r, currentMonthLabel: label, historyCount: months.length - 1 };
  }, [months]);

  const subtitle = currentMonthLabel
    ? `${currentMonthLabel} vs prior ${historyCount} months`
    : "Flags unusual spending patterns";

  if (!report) {
    return (
      <WidgetCard
        title="Anomaly Detection"
        subtitle={subtitle}
      >
        <p className="text-white/40 text-xs text-center py-8">
          Need at least 4 months of data
        </p>
      </WidgetCard>
    );
  }

  const all = [
    ...report.categoryAnomalies.map((a) => ({
      key: `anomaly-${a.category}`,
      severity: a.severity,
      type: a.type as "spike" | "drop",
      category: a.category,
      message: a.message,
    })),
    ...report.inactiveCategories.map((a) => ({
      key: `inactive-${a.category}`,
      // Elevate to warning if avg > $50 — missing a big recurring expense is notable
      severity: (a.historicalAvg > 50 ? "warning" : "info") as AnomalySeverity,
      type: "drop" as const,
      category: a.category,
      message: a.message,
    })),
  ];

  if (all.length === 0) {
    return (
      <WidgetCard
        title="Anomaly Detection"
        subtitle={subtitle}
      >
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <span className="text-lg">✓</span>
          </div>
          <p className="text-xs text-emerald-400">
            No unusual spending patterns detected
          </p>
          <p className="text-[10px] text-white/30">
            All categories within normal ranges
          </p>
        </div>
      </WidgetCard>
    );
  }

  const criticalCount = all.filter((a) => a.severity === "critical").length;
  const warningCount = all.filter((a) => a.severity === "warning").length;
  const infoCount = all.filter((a) => a.severity === "info").length;

  return (
    <WidgetCard
      interactive
      title="Anomaly Detection"
      subtitle={`${subtitle} · ${all.length} pattern${all.length > 1 ? "s" : ""}`}
      action={
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
              {warningCount} warn
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        {all.slice(0, 6).map((item) => {
          const config = severityConfig[item.severity];
          const Icon = config.icon;

          return (
            <button
              key={item.key}
              onClick={() => onCategoryClick?.(item.category)}
              className={cn(
                "w-full flex items-start gap-2.5 p-2 rounded-lg transition-colors text-left",
                config.bg,
                "hover:bg-white/5",
              )}
            >
              <div className="shrink-0 mt-0.5">
                {item.type === "spike" ? (
                  <TrendingUp className={cn("w-3.5 h-3.5", config.color)} />
                ) : (
                  <TrendingDown className={cn("w-3.5 h-3.5", config.color)} />
                )}
              </div>
              <div className="min-w-0">
                <p className={cn("text-xs font-medium", config.color)}>
                  {item.category}
                </p>
                <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">
                  {item.message}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </WidgetCard>
  );
}
