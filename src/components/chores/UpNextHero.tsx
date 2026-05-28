"use client";

import { ChorePostponeSheet } from "@/components/chores/ChorePostponeSheet";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getChorePlannedAt,
  type ChorePostponeTarget,
  useChoreActions,
} from "@/features/chores/useChoreActions";
import { type FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getTimeOfDay, timeOfDayConfig } from "@/lib/utils/timeOfDay";
import { format, parseISO } from "date-fns";
import {
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { useState } from "react";

interface UpNextHeroProps {
  entry: FlexibleRoutineItem;
  currentUserId?: string;
}

function PriorityDot({ priority }: { priority: "high" | "urgent" }) {
  const isUrgent = priority === "urgent";
  const color = isUrgent ? "#f43f5e" : "#f59e0b";
  const label = isUrgent ? "Urgent" : "High";

  return (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color }}
    >
      <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden>
        <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
      </svg>
      {label}
    </span>
  );
}

export function UpNextHero({ entry, currentUserId }: UpNextHeroProps) {
  const { theme } = useTheme();
  const tc = useThemeClasses();
  const choreActions = useChoreActions(entry);
  const [showPostponeSheet, setShowPostponeSheet] = useState(false);

  const isPink = theme === "pink";
  const isOwner = currentUserId
    ? entry.responsible_user_id === currentUserId
    : true;
  const borderColor = isOwner
    ? isPink
      ? "#ec4899"
      : "#3b82f6"
    : isPink
      ? "#3b82f6"
      : "#ec4899";

  const plannedAt = getChorePlannedAt(entry);
  const parsedDue = parseISO(plannedAt);
  const timeOfDay = getTimeOfDay(parsedDue);
  const todConfig = timeOfDayConfig[timeOfDay];
  const TodIcon = todConfig.icon;
  const timeStr = timeOfDay !== "all-day" ? format(parsedDue, "h:mm a") : null;

  const priority = entry.priority as string | undefined;
  const showPriority = priority === "high" || priority === "urgent";

  const handlePostpone = (to: ChorePostponeTarget, customDate?: string) => {
    choreActions.postpone(to, customDate);
  };

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl border-2 p-5"
        style={{
          borderColor,
          background: `linear-gradient(135deg, ${borderColor}10 0%, transparent 60%)`,
          boxShadow: `0 0 24px ${borderColor}18`,
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider",
              todConfig.color,
            )}
          >
            <TodIcon className="h-3.5 w-3.5" />
            {todConfig.label}
          </span>
          {showPriority && (
            <PriorityDot priority={priority as "high" | "urgent"} />
          )}
        </div>

        <p
          className={cn(
            "px-2 text-center text-xl font-bold leading-tight",
            tc.headerText,
            timeStr ? "mb-2" : "mb-5",
          )}
        >
          {entry.title}
        </p>

        {timeStr && (
          <p className="mb-5 text-center text-sm font-semibold text-white/50">
            {timeStr}
          </p>
        )}

        <div
          className={cn(
            "grid gap-2",
            choreActions.hasPartner ? "grid-cols-4" : "grid-cols-3",
          )}
        >
          <button
            type="button"
            onClick={() => choreActions.complete()}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-emerald-500/20 px-2 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 active:scale-[0.98]"
          >
            <CheckCircle2 className="h-4 w-4" />
            Done
          </button>
          <button
            type="button"
            onClick={() => setShowPostponeSheet(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-amber-500/15 px-2 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/25 active:scale-[0.98]"
          >
            <CalendarClock className="h-4 w-4" />
            Postpone
          </button>
          <button
            type="button"
            onClick={() => choreActions.skip()}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/10 active:scale-[0.98]"
          >
            <CalendarX className="h-4 w-4" />
            Skip
          </button>
          {choreActions.hasPartner && (
            <button
              type="button"
              onClick={() => choreActions.transferToPartner()}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-white/5 px-2 py-2 text-xs font-semibold text-white/55 transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              <UserRoundPlus className="h-4 w-4" />
              Partner
            </button>
          )}
        </div>
      </div>

      <ChorePostponeSheet
        isOpen={showPostponeSheet}
        onClose={() => setShowPostponeSheet(false)}
        onPostpone={handlePostpone}
        plannedAt={plannedAt}
      />
    </>
  );
}

export function UpNextEmpty() {
  const tc = useThemeClasses();

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Sparkles className="h-8 w-8 text-emerald-400/40" />
      <p className={cn("text-sm font-medium", tc.headerText)}>All caught up!</p>
      <p className="text-xs text-white/30">No chores assigned for today</p>
    </div>
  );
}
