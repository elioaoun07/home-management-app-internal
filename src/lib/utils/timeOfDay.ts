// src/lib/utils/timeOfDay.ts
// Time-of-day grouping utilities shared across chores and reminders.

import {
  Calendar,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from "lucide-react";

export type TimeOfDay = "all-day" | "morning" | "afternoon" | "evening" | "night";

export const timeOfDayConfig: Record<
  TimeOfDay,
  { label: string; icon: LucideIcon; color: string }
> = {
  "all-day": { label: "All Day", icon: Calendar, color: "text-white/50" },
  morning:   { label: "Morning", icon: Sunrise, color: "text-amber-400" },
  afternoon: { label: "Afternoon", icon: Sun, color: "text-yellow-400" },
  evening:   { label: "Evening", icon: Sunset, color: "text-orange-400" },
  night:     { label: "Night", icon: Moon, color: "text-indigo-400" },
};

export function getTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  const minute = date.getMinutes();
  if (hour === 0 && minute === 0) return "all-day";
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function groupByTimeOfDay<T>(
  items: T[],
  getDate: (item: T) => Date,
): { period: TimeOfDay; items: T[] }[] {
  const order: TimeOfDay[] = ["all-day", "morning", "afternoon", "evening", "night"];
  const groups = new Map<TimeOfDay, T[]>();
  for (const item of items) {
    const period = getTimeOfDay(getDate(item));
    if (!groups.has(period)) groups.set(period, []);
    groups.get(period)!.push(item);
  }
  return order
    .filter((p) => groups.has(p))
    .map((p) => ({ period: p, items: groups.get(p)! }));
}
