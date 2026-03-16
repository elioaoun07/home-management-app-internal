"use client";

import WidgetCard from "@/components/dashboard-v2/WidgetCard";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useEffect, useState } from "react";

type Props = {
  score: number;
  factors: { label: string; score: number; weight: number; max: number }[];
};

export default function HealthScoreWidget({ score, factors }: Props) {
  const tc = useThemeClasses();
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1200;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out expo
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

  // Gauge SVG
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half circle
  const fillPct = score / 100;
  const dashOffset = circumference * (1 - fillPct);

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
    <WidgetCard title="Financial Health" subtitle={label}>
      {/* Gauge */}
      <div className="flex justify-center mb-2">
        <div
          className="relative"
          style={{ width: size, height: size / 2 + 20 }}
        >
          <svg
            width={size}
            height={size / 2 + 10}
            viewBox={`0 0 ${size} ${size / 2 + 10}`}
          >
            {/* Background arc */}
            <path
              d={describeArc(size / 2, size / 2, radius, 180, 360)}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {/* Filled arc */}
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
          {/* Center score */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <span className="text-3xl font-bold tabular-nums" style={{ color }}>
              {animatedScore}
            </span>
            <span className="text-white/30 text-xs"> / 100</span>
          </div>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-1.5 mt-1">
        {factors.map((f) => (
          <div key={f.label} className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 w-24 shrink-0">
              {f.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(f.score / f.max) * 100}%`,
                  backgroundColor: color,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="text-[10px] text-white/40 w-8 text-right tabular-nums">
              {f.score}/{f.max}
            </span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

// SVG arc path helper
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
