"use client";

import { useEffect, useState } from "react";

export type WeekStart = "sun" | "mon";

export type DatePrefs = {
  week_start: WeekStart; // "sun" | "mon"
  month_start_day: number; // 1..28
};

const LS_KEY = "user_preferences"; // share same local key

function readLocal(): Partial<DatePrefs & { date_start?: string }> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(partial: Partial<DatePrefs & { date_start?: string }>) {
  try {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LS_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    const merged = { ...existing, ...partial };
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {}
}

function parseDateStart(s?: string): DatePrefs | null {
  if (!s) return null;
  const m = s.match(/^(sun|mon)-(\d{1,2})$/);
  if (!m) return null;
  const wk = m[1] as WeekStart;
  const day = Number(m[2]);
  if (day < 1 || day > 28) return null;
  return { week_start: wk, month_start_day: day };
}

function formatDateStart(p: DatePrefs): string {
  return `${p.week_start}-${p.month_start_day}`;
}

export function useDatePreferences() {
  const [prefs, setPrefs] = useState<DatePrefs>({
    week_start: "sun",
    month_start_day: 1,
  });
  const [loaded, setLoaded] = useState(false);

  // Load local immediately
  useEffect(() => {
    const local = readLocal();
    const parsed = parseDateStart(local.date_start as string | undefined);
    if (parsed) setPrefs(parsed);
    else {
      // fallback to explicit keys if present
      const wk = local.week_start === "mon" ? "mon" : "sun";
      let md = Number(local.month_start_day);
      if (!Number.isInteger(md) || md < 1 || md > 28) md = 1;
      setPrefs({ week_start: wk, month_start_day: md });
    }
    setLoaded(true);
  }, []);

  // Best-effort GET from server to sync (doesn't block UI)
  // OPTIMIZED: Only sync if user preferences might have changed
  // This runs in background, doesn't affect initial load
  useEffect(() => {
    let ignore = false;
    // Delay server sync to not compete with initial page load
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch("/api/user-preferences");
        if (!res.ok) return;
        const data = await res.json();
        const parsed = parseDateStart(data?.date_start);
        if (parsed && !ignore) {
          setPrefs(parsed);
          writeLocal({ date_start: formatDateStart(parsed) });
        }
      } catch {}
    }, 2000); // Delay 2 seconds to not block initial render

    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, []);

  async function update(next: Partial<DatePrefs>) {
    setPrefs((prev) => {
      const merged: DatePrefs = {
        week_start: next.week_start ?? prev.week_start,
        month_start_day: next.month_start_day ?? prev.month_start_day,
      };
      writeLocal({ date_start: formatDateStart(merged) });
      // Fire and forget server sync
      fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_start: formatDateStart(merged) }),
      }).catch(() => {});
      return merged;
    });
  }

  return {
    prefs,
    loaded,
    update,
  } as const;
}

// Utilities for range calculations
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(date: Date, weekStart: WeekStart) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = weekStart === "sun" ? day : (day + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfCustomMonth(date: Date, monthStartDay: number) {
  const d = new Date(date);
  const currentDay = d.getDate();
  const s = new Date(d);
  if (currentDay >= monthStartDay) {
    s.setDate(monthStartDay);
  } else {
    s.setMonth(s.getMonth() - 1);
    s.setDate(monthStartDay);
  }
  s.setHours(0, 0, 0, 0);
  return s;
}

export function startOfQuarter(date: Date) {
  const d = new Date(date);
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
