"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import type { LucideIcon } from "lucide-react";
import { BarChart2, CreditCard, PiggyBank, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  score: number;
  factors: { label: string; score: number; weight: number; max: number }[];
  previousScore?: number;
  periodLabel?: string;
};

const FACTOR_META: Record<string, { tip: string; Icon: LucideIcon }> = {
  "Savings Rate": { tip: "Target ≥ 20% of income saved", Icon: PiggyBank },
  "Spending Trend": { tip: "Stable or declining expenses", Icon: TrendingDown },
  "Debt Health": { tip: "Low debt-to-income ratio", Icon: CreditCard },
  "Debt Load": { tip: "Low debt-to-income ratio", Icon: CreditCard },
  Consistency: { tip: "Low month-to-month variance", Icon: BarChart2 },
};

export default function HealthScoreWidget({
  score,
  factors,
  previousScore,
  periodLabel,
}: Props) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1200;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color = score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";
  const label =
    score >= 70 ? "Healthy" : score >= 40 ? "Fair" : "Needs Attention";

  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const fillPct = score / 100;

  const scoreDelta = previousScore !== undefined ? score - previousScore : null;

  if (score === 0 && factors.length === 0) {
    return (
      <WidgetCard title="Financial Health">
        <p className="text-white/40 text-xs text-center py-8">
          Not enough data to calculate
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Financial Health"
      subtitle={periodLabel ?? label}
      action={
        scoreDelta !== null && Math.abs(scoreDelta) >= 1 ? (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              scoreDelta >= 0
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {scoreDelta >= 0 ? "+" : ""}
            {scoreDelta} pts
          </span>
        ) : undefined
      }
    >
      <div className="flex items-start gap-4">
        {/* Gauge */}
        <div
          className="relative shrink-0"
          style={{ width: size, height: size / 2 + 16 }}
        >
          <svg
            width={size}
            height={size / 2 + 10}
            viewBox={`0 0 ${size} ${size / 2 + 10}`}
          >
            <path
              d={describeArc(size / 2, size / 2, radius, 180, 360)}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d={describeArc(
                size / 2,
                size / 2,
                radius,
                180,
                180 + 180 * fillPct,
              )}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${color}80)`,
                transition: "d 1.2s ease-out",
              }}
            />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>
              {animatedScore}
            </span>
            <span className="text-white/30 text-[10px]"> / 100</span>
          </div>
        </div>

        {/* Factor bars */}
        <div className="flex-1 space-y-2.5 pt-1">
          {factors.map((f) => {
            const pct = f.max > 0 ? (f.score / f.max) * 100 : 0;
            const fc =
              pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
            const meta = FACTOR_META[f.label];
            const Icon = meta?.Icon;
            return (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {Icon && (
                      <Icon
                        className="w-3 h-3 shrink-0"
                        style={{ color: fc, opacity: 0.8 }}
                      />
                    )}
                    <span className="text-[10px] text-white/60 font-medium">
                      {f.label}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-semibold tabular-nums"
                    style={{ color: fc }}
                  >
                    {f.score}/{f.max}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: fc,
                      opacity: 0.75,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetCard>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, degrees: number) {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
