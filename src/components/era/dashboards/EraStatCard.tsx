"use client";

// Shared ERA stat card — hue-matched glassmorphism panel.
// Used inside per-face dashboards as the top-row metric blocks.

import React from "react";

type Props = {
  label: string;
  value: string | number;
  sub?: string;
  hue: number;
  loading?: boolean;
};

export function EraStatCard({ label, value, sub, hue, loading }: Props) {
  const border = `hsla(${hue}, 55%, 45%, 0.22)`;
  const glow = `hsla(${hue}, 60%, 40%, 0.07)`;
  const accent = `hsl(${hue}, 72%, 68%)`;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-2xl p-4"
      style={{
        background: `hsla(${hue}, 18%, 7%, 0.82)`,
        border: `1px solid ${border}`,
        boxShadow: `0 0 20px ${glow} inset, 0 4px 24px rgba(0,0,0,0.45)`,
        backdropFilter: "blur(14px)",
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.13em]"
        style={{ color: `hsla(${hue}, 60%, 65%, 0.65)` }}
      >
        {label}
      </span>

      {loading ? (
        <div className="h-7 w-20 animate-pulse rounded-lg bg-white/8" />
      ) : (
        <span
          className="text-2xl font-bold tabular-nums leading-none"
          style={{ color: accent }}
        >
          {value}
        </span>
      )}

      {sub && !loading && (
        <span className="text-xs leading-snug text-white/40">{sub}</span>
      )}
    </div>
  );
}
