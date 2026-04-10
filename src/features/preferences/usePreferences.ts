// src/features/preferences/usePreferences.ts
"use client";

import { safeFetch } from "@/lib/safeFetch";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const LS_PREFS_KEY = "user_preferences"; // legacy + current consolidated key
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

type LocalPrefs = {
  section_order?: string[] | null;
  theme?: "light" | "dark" | null; // null = system
  updatedAt?: number; // last successful server sync
};

function readLocal(): LocalPrefs {
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(LS_PREFS_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed ?? {};
  } catch {
    return {};
  }
}

function writeLocal(partial: Partial<LocalPrefs>) {
  try {
    if (typeof window === "undefined") return;
    const existing = readLocal();
    const merged = { ...existing, ...partial };
    localStorage.setItem(LS_PREFS_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

function normalizeThemeToChoice(
  theme: LocalPrefs["theme"]
): ThemeChoice | undefined {
  if (theme === "light" || theme === "dark") return theme;
  if (theme === null) return "system";
  return undefined;
}

export function usePreferences() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme();
  const [initialized, setInitialized] = useState(false);

  // Derive a stable "choice" value for consumers
  const choice = useMemo<ThemeChoice>(() => {
    // When next-themes hasn't hydrated yet, theme can be undefined. Prefer system.
    const t = theme as ThemeChoice | undefined;
    return t ?? "system";
  }, [theme]);

  // 1) On mount, apply any locally stored preference immediately (no network)
  useEffect(() => {
    const local = readLocal();
    const localChoice = normalizeThemeToChoice(local.theme);
    if (localChoice && localChoice !== choice) {
      // This will also cause next-themes to persist it under its storageKey
      setTheme(localChoice);
    }
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) No background GET: stay local-first to avoid network on app open

  // 3) Update helpers
  const updateTheme = useCallback(
    async (next: ThemeChoice) => {
      // Update UI immediately
      setTheme(next);
      // Persist locally (store choice; keep system as null so we remember intent)
      writeLocal({ theme: next === "system" ? null : next });
      // Compute effective theme for DB (send only 'light' | 'dark')
      let effective: "light" | "dark";
      if (next === "system") {
        // Prefer next-themes computed systemTheme; fallback to matchMedia
        const eff =
          (systemTheme as "light" | "dark" | undefined) ??
          (typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light");
        effective = eff;
      } else {
        effective = next;
      }
      // Best-effort server sync (do not block UI). Always send effective value.
      try {
        await safeFetch("/api/user-preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: effective }),
        });
        writeLocal({ updatedAt: Date.now() });
      } catch {
        // ignore; will try again later
      }
    },
    [setTheme, systemTheme]
  );

  return {
    // theme as choice: "light" | "dark" | "system"
    theme: choice,
    resolvedTheme,
    updateTheme,
  } as const;
}
