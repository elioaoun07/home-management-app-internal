// src/features/pm-live/chartTheme.ts
// Chart-side mirror of the CSS tokens in src/app/pm/live/pm-live.css. Recharts
// needs literal color strings (it writes them into SVG attributes), so the two
// files must be edited together.

import type { TaskSeverity } from "./types";

export const CHART = {
  surface: "#0a1628",
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.42)",
  accent: "#22d3ee",
  warn: "#fbbf24",
  ok: "#34d399",
  muted: "#64748b",
} as const;

/**
 * Severity is an ORDINAL status scale (blocker > friction > annoyance >
 * parked), not a categorical one, so the categorical "lightness band" and
 * "chroma floor" checks are intentionally not met: high severity must read
 * hotter and brighter than low, and low severity must recede to neutral gray.
 *
 * Validated on the #0a1628 surface with the dataviz validator:
 *   CVD separation PASS (worst adjacent ΔE 15.5 protan)
 *   Normal-vision floor PASS (15.6)
 *   Contrast vs surface PASS (all 4 >= 3:1)
 *
 * Per the status rule, severity is never encoded by color alone — every use
 * carries a text label or an adjacent count.
 *
 * Hard Rule 3 also applies: no red anywhere in this ramp. Amber is the hottest
 * step the app allows outside container headers.
 */
export const SEVERITY_COLOR: Record<Exclude<TaskSeverity, null> | "unrated", string> = {
  blocker: "#fbbf24",
  friction: "#d97706",
  annoyance: "#94a3b8",
  parked: "#64748b",
  unrated: "#334155",
};

export const SEVERITY_ORDER = ["blocker", "friction", "annoyance", "parked", "unrated"] as const;

/** Tailwind equivalents of the ramp, for dots and chips in JSX. */
export const SEVERITY_DOT: Record<string, string> = {
  blocker: "bg-[var(--pm-sev-blocker)]",
  friction: "bg-[var(--pm-sev-friction)]",
  annoyance: "bg-[var(--pm-sev-annoyance)]",
  parked: "bg-[var(--pm-sev-parked)]",
  unrated: "bg-white/15",
};

/** Short human date for axis ticks: "Jul 24". */
export function axisDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatUsd(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "—";
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}
