"use client";

import type { AIUsageStatus, PaceStatus } from "@/types/aiUsage";

/**
 * Mobile-friendly radial usage gauge with an ideal-pace tick marker.
 *
 * - Big center % colored by status.
 * - Background ring + progress arc.
 * - Small tick on the ring at the "ideal pace" position.
 * - Compact cycle timeline strip under the gauge.
 */
export function UsageGauge({
  status,
  size = 220,
}: {
  status: AIUsageStatus;
  size?: number;
}) {
  const { currentPct, expectedPct, daysElapsed, daysTotal } = status;

  // Clamp for visual display (allow overshoot visually capped at 100%).
  const displayPct = Math.max(0, Math.min(100, currentPct));
  const idealPct = Math.max(0, Math.min(100, expectedPct));

  const cx = size / 2;
  const cy = size / 2;
  const stroke = size * 0.09; // ring thickness
  const r = size / 2 - stroke / 2 - 6;
  const circ = 2 * Math.PI * r;
  const progressLen = (displayPct / 100) * circ;

  const colors = STATUS_COLORS[status.status];

  // Ideal-pace tick: angle in degrees clockwise from top.
  const idealAngleDeg = (idealPct / 100) * 360 - 90;
  const idealAngleRad = (idealAngleDeg * Math.PI) / 180;
  const tickOuter = r + stroke / 2 + 2;
  const tickInner = r - stroke / 2 - 2;
  const tx1 = cx + tickOuter * Math.cos(idealAngleRad);
  const ty1 = cy + tickOuter * Math.sin(idealAngleRad);
  const tx2 = cx + tickInner * Math.cos(idealAngleRad);
  const ty2 = cy + tickInner * Math.sin(idealAngleRad);

  const dayProgress = Math.max(0, Math.min(1, daysElapsed / daysTotal));

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Usage: ${currentPct.toFixed(1)}% of budget, ideal pace ${expectedPct.toFixed(1)}%`}
        className="max-w-full"
      >
        <defs>
          <linearGradient
            id={`gauge-grad-${status.status}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={colors.from} />
            <stop offset="100%" stopColor={colors.to} />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />

        {/* Progress arc (rotated so progress starts at 12 o'clock) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`url(#gauge-grad-${status.status})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progressLen} ${circ}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />

        {/* Ideal pace tick */}
        <line
          x1={tx1}
          y1={ty1}
          x2={tx2}
          y2={ty2}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Center: big % */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.22}
          fontWeight={700}
          fill={colors.text}
        >
          {fmt(currentPct)}%
        </text>

        {/* Center: ideal */}
        <text
          x={cx}
          y={cy + size * 0.15}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.065}
          fill="rgba(255,255,255,0.55)"
        >
          ideal {fmt(expectedPct)}%
        </text>
      </svg>

      {/* Cycle timeline strip */}
      <div className="w-full px-1">
        <div className="relative h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-white/25 rounded-full"
            style={{ width: `${dayProgress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/45 mt-1">
          <span>
            Day {daysElapsed}/{daysTotal}
          </span>
          <span>
            {status.daysRemaining} day{status.daysRemaining === 1 ? "" : "s"}{" "}
            left
          </span>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

const STATUS_COLORS: Record<
  PaceStatus,
  { from: string; to: string; text: string }
> = {
  "on-pace": {
    from: "#10b981",
    to: "#34d399",
    text: "#6ee7b7",
  },
  ahead: {
    from: "#06b6d4",
    to: "#38bdf8",
    text: "#7dd3fc",
  },
  behind: {
    from: "#f59e0b",
    to: "#fbbf24",
    text: "#fcd34d",
  },
  critical: {
    from: "#ef4444",
    to: "#f87171",
    text: "#fca5a5",
  },
};
