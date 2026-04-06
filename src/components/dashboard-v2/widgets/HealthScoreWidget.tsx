"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useEffect, useState } from "react";

type Props = {
  score: number;
  factors: { label: string; score: number; weight: number; max: number }[];
  previousScore?: number;
};

const FACTOR_TIPS: Record<string, { tip: string; icon: string }> = {
  "Savings Rate": { tip: "Target ≥ 20% of income saved", icon: "💰" },
  "Spending Trend": { tip: "Stable or declining expenses", icon: "📉" },
  "Debt Load": { tip: "Low debt-to-income ratio", icon: "🧾" },
  Consistency: { tip: "Low month-to-month variance", icon: "📊" },
};

export default function HealthScoreWidget({ score, factors, previousScore }: Props) {
  const tc = useThemeClasses();
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
  const label = score >= 70 ? "Healthy" : score >= 40 ? "Fair" : "Needs Attention";
  const tip =
    score >= 70
      ? "You're on track — keep saving consistently."
      : score >= 40
        ? "Good foundation. Focus on savings rate."
        : "Review spending & reduce debt to improve.";

  const size = 140;
  const strokeWidth = 12;
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
      subtitle={label}
      action={
        scoreDelta !== null && Math.abs(scoreDelta) >= 1 ? (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              scoreDelta >= 0
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {scoreDelta >= 0 ? "+" : ""}{scoreDelta} pts MoM
          </span>
        ) : undefined
      }
    >
      {/* Gauge + tip */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="relative shrink-0"
          style={{ width: size, height: size / 2 + 20 }}
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
              d={describeArc(size / 2, size / 2, radius, 180, 180 + 180 * fillPct)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: "d 1.2s ease-out" }}
            />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>
              {animatedScore}
            </span>
            <span className="text-white/30 text-xs"> / 100</span>
          </div>
        </div>

        {/* Score context */}
        <div className="flex-1 space-y-2">
          <div
            className="rounded-xl p-3 text-xs leading-relaxed"
            style={{ backgroundColor: `${color}12`, border: `1px solid ${color}25` }}
          >
            <p className="font-semibold mb-0.5" style={{ color }}>{label}</p>
            <p className="text-white/50 text-[11px]">{tip}</p>
          </div>

          {/* Grade badges */}
          <div className="grid grid-cols-2 gap-1.5">
            {factors.map((f) => {
              const pct = f.max > 0 ? (f.score / f.max) * 100 : 0;
              const fc = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
              return (
                <div
                  key={f.label}
                  className="rounded-lg p-2 flex items-center gap-1.5"
                  style={{ backgroundColor: `${fc}10` }}
                >
                  <span className="text-[11px]">
                    {FACTOR_TIPS[f.label]?.icon ?? "📌"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] text-white/40 truncate leading-none mb-0.5">{f.label}</p>
                    <p className="text-[11px] font-bold tabular-nums" style={{ color: fc }}>
                      {f.score}<span className="text-white/25 font-normal">/{f.max}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Factor progress bars */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <p className="text-[9px] text-white/30 uppercase tracking-widest mb-2">Score Breakdown</p>
        {factors.map((f) => {
          const pct = f.max > 0 ? (f.score / f.max) * 100 : 0;
          const fc = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
          const meta = FACTOR_TIPS[f.label];
          return (
            <div key={f.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {meta && <span className="text-[11px]">{meta.icon}</span>}
                  <span className="text-[11px] text-white/65 font-medium">{f.label}</span>
                  {meta && (
                    <span className="text-[9px] text-white/30 hidden sm:inline">{meta.tip}</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: fc }}>
                  {f.score}/{f.max}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: fc, opacity: 0.8 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, degrees: number) {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
