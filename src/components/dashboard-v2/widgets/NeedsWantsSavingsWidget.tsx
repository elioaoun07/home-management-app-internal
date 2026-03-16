"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useMemo } from "react";

type Props = {
  data:
    | {
        needs: number;
        wants: number;
        savings: number;
        unclassified: number;
      }
    | undefined;
  totalIncome: number;
};

const TARGETS = { needs: 50, wants: 30, savings: 20 };

export default function NeedsWantsSavingsWidget({ data, totalIncome }: Props) {
  const tc = useThemeClasses();

  const bars = useMemo(() => {
    if (!data || totalIncome === 0) return null;

    const total = data.needs + data.wants + data.savings + data.unclassified;
    const base = totalIncome > 0 ? totalIncome : total;

    return [
      {
        label: "Needs",
        amount: data.needs,
        pct: (data.needs / base) * 100,
        target: TARGETS.needs,
        color: "#3b82f6",
        bgColor: "bg-blue-500/20",
      },
      {
        label: "Wants",
        amount: data.wants,
        pct: (data.wants / base) * 100,
        target: TARGETS.wants,
        color: "#a855f7",
        bgColor: "bg-purple-500/20",
      },
      {
        label: "Savings",
        amount: data.savings,
        pct: (data.savings / base) * 100,
        target: TARGETS.savings,
        color: "#22d3ee",
        bgColor: "bg-cyan-500/20",
      },
    ];
  }, [data, totalIncome]);

  if (!data) {
    return (
      <WidgetCard title="50 / 30 / 20 Rule">
        <p className="text-white/40 text-xs text-center py-8">Loading…</p>
      </WidgetCard>
    );
  }

  const hasClassified = data.needs + data.wants + data.savings > 0;

  return (
    <WidgetCard
      title="50 / 30 / 20 Rule"
      subtitle={
        totalIncome > 0
          ? `Based on $${Math.round(totalIncome).toLocaleString()} income`
          : "No income recorded this month"
      }
    >
      {!hasClassified ? (
        <div className="text-center py-6">
          <p className="text-white/50 text-xs mb-1">
            Categories not classified yet
          </p>
          <p className="text-white/30 text-[10px]">
            Go to category settings to tag each category as Need, Want, or
            Saving
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bars?.map((bar) => {
            const overBudget = bar.pct > bar.target;
            const statusColor = overBudget
              ? "text-amber-400"
              : "text-emerald-400";
            const diff = bar.pct - bar.target;

            return (
              <div key={bar.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/70 font-medium">
                    {bar.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40">
                      ${Math.round(bar.amount).toLocaleString()}
                    </span>
                    <span className={`text-[10px] font-medium ${statusColor}`}>
                      {bar.pct.toFixed(1)}%
                      <span className="text-white/30 ml-1">
                        / {bar.target}%
                      </span>
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
                  {/* Target marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/30 z-10"
                    style={{ left: `${Math.min(bar.target, 100)}%` }}
                  />
                  {/* Actual bar */}
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(bar.pct, 100)}%`,
                      backgroundColor: bar.color,
                      opacity: overBudget ? 0.9 : 0.7,
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {overBudget
                    ? `${diff.toFixed(1)}% over target`
                    : `${Math.abs(diff).toFixed(1)}% under target`}
                </p>
              </div>
            );
          })}

          {data.unclassified > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-white/5 text-center">
              <p className="text-[10px] text-white/40">
                ${Math.round(data.unclassified).toLocaleString()} in
                unclassified categories
              </p>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
