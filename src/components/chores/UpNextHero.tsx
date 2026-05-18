"use client";

import { ChoreActionsSheet } from "@/components/chores/ChoreActionsSheet";
import { ChorePostponeSheet } from "@/components/chores/ChorePostponeSheet";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import {
  type ChorePostponeTarget,
  useChoreActions,
} from "@/features/chores/useChoreActions";
import { type FlexibleRoutineItem } from "@/features/items/useFlexibleRoutines";
import { cn } from "@/lib/utils";
import { timeOfDayConfig, getTimeOfDay } from "@/lib/utils/timeOfDay";
import { format, parseISO } from "date-fns";
import { ArrowRightLeft, Ban, CheckCircle2, Clock, Sparkles } from "lucide-react";
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
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showPostponeSheet, setShowPostponeSheet] = useState(false);

  const isPink = theme === "pink";
  const isOwner = currentUserId
    ? entry.responsible_user_id === currentUserId
    : true;
  const borderColor = isOwner
    ? isPink ? "#ec4899" : "#3b82f6"
    : isPink ? "#3b82f6" : "#ec4899";

  const dueAt = entry.reminder_details?.due_at;
  const parsedDue = dueAt ? parseISO(dueAt) : null;
  const timeOfDay = parsedDue ? getTimeOfDay(parsedDue) : "all-day";
  const todConfig = timeOfDayConfig[timeOfDay];
  const TodIcon = todConfig.icon;
  const timeStr = parsedDue && timeOfDay !== "all-day"
    ? format(parsedDue, "h:mm a")
    : null;

  const priority = entry.priority as string | undefined;
  const showPriority = priority === "high" || priority === "urgent";

  const handlePostpone = (to: ChorePostponeTarget, customDate?: string) => {
    choreActions.postpone(to, customDate);
  };

  return (
    <>
      <div
        className="relative rounded-2xl border-2 p-5 overflow-hidden"
        style={{
          borderColor,
          background: `linear-gradient(135deg, ${borderColor}10 0%, transparent 60%)`,
          boxShadow: `0 0 24px ${borderColor}18`,
        }}
      >
        {/* Eyebrow row — time-of-day label + priority */}
        <div className="flex items-center justify-between mb-4">
          <span className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider", todConfig.color)}>
            <TodIcon className="w-3.5 h-3.5" />
            {todConfig.label}
          </span>
          {showPriority && (
            <PriorityDot priority={priority as "high" | "urgent"} />
          )}
        </div>

        {/* Centered title */}
        <p className={cn("text-center text-xl font-bold leading-tight px-2", tc.headerText, timeStr ? "mb-2" : "mb-5")}>
          {entry.title}
        </p>

        {/* Time — only shown when a specific time is set */}
        {timeStr && (
          <p className="text-center text-sm font-semibold text-white/50 mb-5">{timeStr}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => choreActions.complete()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/20 py-2.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/30 active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            Done
          </button>
          <button
            type="button"
            onClick={() => setShowPostponeSheet(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 active:scale-[0.98]"
          >
            <Clock className="w-4 h-4" />
            Later
          </button>
          <button
            type="button"
            onClick={() => choreActions.skip()}
            className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/10 active:scale-[0.98]"
          >
            <Ban className="w-4 h-4" />
          </button>
          {choreActions.hasPartner && (
            <button
              type="button"
              onClick={() => choreActions.transferToPartner()}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/10 active:scale-[0.98]"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <ChoreActionsSheet
        isOpen={showActionsSheet}
        onClose={() => setShowActionsSheet(false)}
        title={entry.title}
        onComplete={() => choreActions.complete()}
        onSkip={() => choreActions.skip()}
        onPostpone={handlePostpone}
        onTransfer={choreActions.hasPartner ? () => choreActions.transferToPartner() : undefined}
        hasPartner={choreActions.hasPartner}
      />

      <ChorePostponeSheet
        isOpen={showPostponeSheet}
        onClose={() => setShowPostponeSheet(false)}
        onPostpone={handlePostpone}
      />
    </>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function UpNextEmpty() {
  const tc = useThemeClasses();
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
      <Sparkles className="w-8 h-8 text-emerald-400/40" />
      <p className={cn("text-sm font-medium", tc.headerText)}>All caught up!</p>
      <p className="text-xs text-white/30">No chores assigned for today</p>
    </div>
  );
}
