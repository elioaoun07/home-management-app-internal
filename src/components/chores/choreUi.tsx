"use client";

import type { ChoreDayOption } from "@/features/chores/choreWeek";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { addDays, format, isToday, parseISO } from "date-fns";

export interface ChorePerson {
  label: string;
  /** Person-absolute color: blue-theme user is blue on both phones */
  color: "blue" | "pink";
}

export function useChoreTone() {
  const tc = useThemeClasses();
  const { isFrost, isCalm } = tc;
  const border = isFrost
    ? "border-slate-200/90"
    : isCalm
      ? "border-stone-600/45"
      : "border-white/[0.08]";
  return {
    tc,
    isFrost,
    isCalm,
    border,
    row: cn(tc.surfaceBgMuted, border),
    panel: cn(tc.surfaceBg, border),
    main: isFrost
      ? "text-slate-900"
      : isCalm
        ? "text-stone-100"
        : "text-white/90",
    soft: isFrost
      ? "text-slate-600"
      : isCalm
        ? "text-stone-400"
        : "text-white/60",
    subtle: isFrost
      ? "text-slate-500"
      : isCalm
        ? "text-stone-400"
        : "text-white/40",
    ghost: isFrost
      ? "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80"
      : isCalm
        ? "bg-stone-700/40 text-stone-300 hover:bg-stone-700"
        : "bg-white/5 text-white/70 hover:bg-white/10",
    selected: cn(tc.bgSurface, tc.text, tc.border),
    accent: tc.text,
    accentSurface: cn(tc.bgSurface, tc.border),
    focus: cn(
      "outline-none focus-visible:ring-2 focus-visible:ring-inset",
      tc.ringActive,
    ),
  };
}

/** Person-absolute classes for outlines, swipe reveals and filter tabs. */
export function personTone(color: ChorePerson["color"], isFrost = false) {
  return color === "pink"
    ? {
        outline: isFrost ? "border-pink-300" : "border-pink-500/45",
        reveal: "bg-pink-500/10",
        revealStrong: "bg-pink-500/25",
        text: isFrost ? "text-pink-700" : "text-pink-400",
        tab: isFrost
          ? "border-pink-500 text-pink-700"
          : "border-pink-500 text-pink-400",
      }
    : {
        outline: isFrost ? "border-blue-300" : "border-blue-500/45",
        reveal: "bg-blue-500/10",
        revealStrong: "bg-blue-500/25",
        text: isFrost ? "text-blue-700" : "text-blue-400",
        tab: isFrost
          ? "border-blue-500 text-blue-700"
          : "border-blue-500 text-blue-400",
      };
}

export function PersonTag({ person }: { person: ChorePerson | null }) {
  const { isFrost } = useChoreTone();
  if (!person) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-[8rem] shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        person.color === "pink"
          ? isFrost
            ? "bg-pink-50 text-pink-700"
            : "bg-pink-500/10 text-pink-400"
          : isFrost
            ? "bg-blue-50 text-blue-700"
            : "bg-blue-500/10 text-blue-400",
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        aria-hidden
      />
      <span className="truncate">{person.label}</span>
    </span>
  );
}

export function formatChoreTime(time: string | null): string | null {
  if (!time) return null;
  return format(parseISO(`2000-01-01T${time.slice(0, 5)}`), "h:mm a");
}

export function formatDayHeading(date: string, todayKey: string): string {
  if (date === todayKey) return "Today";
  if (date === format(addDays(parseISO(todayKey), 1), "yyyy-MM-dd")) {
    return "Tomorrow";
  }
  return format(parseISO(date), "EEEE d");
}

/** Seven weekday chips for one week. One tap picks a day. */
export function ChoreDayChips({
  days,
  selected,
  disabled,
  onPick,
}: {
  days: ChoreDayOption[];
  selected?: string;
  disabled?: boolean;
  onPick: (option: ChoreDayOption) => void;
}) {
  const tone = useChoreTone();
  return (
    <div
      className="grid grid-cols-7 gap-1"
      role="group"
      aria-label="Choose a day"
    >
      {days.map((option) => {
        const day = parseISO(option.date);
        const isSelected = option.date === selected;
        const isDisabled = disabled || !option.enabled || isSelected;
        const today = isToday(day);
        return (
          <button
            key={option.date}
            type="button"
            disabled={isDisabled}
            onClick={() => onPick(option)}
            aria-label={`${format(day, "EEEE, MMMM d")}${isSelected ? ", selected" : !option.enabled ? ", unavailable" : ""}`}
            aria-pressed={isSelected}
            aria-current={today ? "date" : undefined}
            className={cn(
              "relative flex h-14 min-w-0 flex-col items-center justify-center rounded-xl border text-[10px] font-semibold transition-colors active:scale-95 motion-reduce:transform-none",
              tone.focus,
              isSelected ? tone.selected : cn(tone.ghost, "border-transparent"),
              !isSelected && isDisabled && "opacity-30 active:scale-100",
            )}
          >
            <span className="uppercase tracking-wide opacity-75">
              {format(day, "EEE")}
            </span>
            <span className="mt-1 text-base leading-none tabular-nums">
              {format(day, "d")}
            </span>
            {today && (
              <span
                className="absolute bottom-1 h-1 w-1 rounded-full bg-current"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
