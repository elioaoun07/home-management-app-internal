"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { cn } from "@/lib/utils";
import {
  type ComparisonResult,
  getCurrentSeasonComparison,
  getMonthOverMonth,
  getSameMonthLastYear,
  getYearOverYear,
} from "@/lib/utils/comparisonAnalytics";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarRange,
  Leaf,
  Repeat,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

type Transaction = {
  id: string;
  date: string;
  amount: number;
  category?: string | null;
  account_id?: string;
};

type Props = {
  transactions: Transaction[];
};

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <ArrowUp className="w-3.5 h-3.5 text-red-400" />;
  if (trend === "down")
    return <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />;
  return <ArrowRight className="w-3.5 h-3.5 text-white/30" />;
}

function ComparisonCell({
  label,
  icon: Icon,
  result,
  iconColor,
}: {
  label: string;
  icon: typeof TrendingUp;
  result: ComparisonResult | null;
  iconColor: string;
}) {
  if (!result) return null;

  const pctStr =
    Math.abs(result.changePercent) < 0.5
      ? "flat"
      : `${result.changePercent > 0 ? "+" : ""}${result.changePercent.toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/5">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm font-semibold text-white tabular-nums">
            $
            {result.currentTotal.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[10px] text-white/30 tabular-nums">
            vs $
            {result.previousTotal.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon trend={result.trend} />
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              result.trend === "up"
                ? "text-red-400"
                : result.trend === "down"
                  ? "text-emerald-400"
                  : "text-white/40",
            )}
          >
            {pctStr}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PeriodComparisonExtendedWidget({
  transactions,
}: Props) {
  const mom = useMemo(() => getMonthOverMonth(transactions), [transactions]);
  const sameMonthLY = useMemo(
    () => getSameMonthLastYear(transactions),
    [transactions],
  );
  const yoy = useMemo(() => getYearOverYear(transactions), [transactions]);
  const season = useMemo(
    () => getCurrentSeasonComparison(transactions),
    [transactions],
  );

  return (
    <WidgetCard
      title="Period Comparisons"
      subtitle="Spending across time periods"
    >
      <div className="grid grid-cols-2 gap-3">
        <ComparisonCell
          label="Month / Month"
          icon={Repeat}
          result={mom}
          iconColor="text-cyan-400"
        />
        <ComparisonCell
          label="Same Month LY"
          icon={CalendarRange}
          result={sameMonthLY}
          iconColor="text-violet-400"
        />
        <ComparisonCell
          label="Year / Year"
          icon={TrendingUp}
          result={yoy}
          iconColor="text-amber-400"
        />
        <ComparisonCell
          label={`${season.season} vs LY`}
          icon={Leaf}
          result={season}
          iconColor="text-emerald-400"
        />
      </div>
    </WidgetCard>
  );
}
