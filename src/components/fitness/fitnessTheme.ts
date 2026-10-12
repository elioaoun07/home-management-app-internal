// src/components/fitness/fitnessTheme.ts
// Fitness palette per app theme. Surfaces/text come from the theme (Hard
// Rule 10: --theme-bg + data-theme stay the page background); these are the
// accent stops for the SVG core and the ink tokens for light (Frost) vs dark.
"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";

export interface FitnessPalette {
  a: string;
  b: string;
  c: string;
  track: string;
  ink: string;
  mute: string;
  faint: string;
  line: string;
  card: string;
  chip: string;
  isLight: boolean;
  /** Person-absolute partner color (Hard Rule 14): pink user → partner blue. */
  partner: { text: string; ring: string; bg: string };
}

const DARK = {
  ink: "text-white",
  mute: "text-white/60",
  faint: "text-white/35",
  line: "border-white/10",
  card: "bg-white/[0.04]",
  chip: "bg-white/[0.06]",
  track: "rgba(255,255,255,0.09)",
  isLight: false,
};

const PALETTES: Record<string, Omit<FitnessPalette, "partner">> = {
  blue: { ...DARK, a: "#22d3ee", b: "#3b82f6", c: "#a78bfa" },
  pink: { ...DARK, a: "#f472b6", b: "#f59e0b", c: "#c084fc" },
  calm: { ...DARK, a: "#34d399", b: "#a8a29e", c: "#fbbf24", ink: "text-stone-200", mute: "text-stone-400", faint: "text-stone-500", line: "border-stone-700", card: "bg-stone-800/50", chip: "bg-stone-800" },
  frost: {
    a: "#6366f1", b: "#8b5cf6", c: "#06b6d4", track: "rgba(15,23,42,0.08)", ink: "text-slate-900", mute: "text-slate-500",
    faint: "text-slate-400", line: "border-slate-200", card: "bg-white", chip: "bg-slate-100", isLight: true,
  },
};

export function useFitnessPalette(): FitnessPalette {
  const { theme } = useTheme();
  // Match useThemeClasses: default palette until mounted (no hydration drift).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = mounted ? theme : "blue";
  const base = PALETTES[t] ?? PALETTES.blue;
  const partnerPink = t !== "pink";
  return {
    ...base,
    partner: partnerPink
      ? { text: "text-pink-400", ring: "border-pink-400/40", bg: "bg-pink-500/10" }
      : { text: "text-blue-400", ring: "border-blue-400/40", bg: "bg-blue-500/10" },
  };
}

/** Pauses ambient animation while the tab is hidden. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}
