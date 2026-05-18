"use client";

import { type UserFilter } from "@/components/activity/FilterBar";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Heart, Users, User } from "lucide-react";

interface ChoresFilterBarProps {
  userFilter: UserFilter;
  onUserFilterChange: (v: UserFilter) => void;
  showCompleted: boolean;
  onShowCompletedChange: (v: boolean) => void;
  doneCount: number;
}

export function ChoresFilterBar({
  userFilter,
  onUserFilterChange,
  showCompleted,
  onShowCompletedChange,
  doneCount,
}: ChoresFilterBarProps) {
  const { theme } = useTheme();
  const tc = useThemeClasses();

  const meColor   = theme === "pink" ? "#ec4899" : "#3b82f6";
  const bothColor = tc.textActive;
  const partColor = theme === "pink" ? "#3b82f6" : "#ec4899";

  const tabs: { key: UserFilter; label: string; Icon: typeof User; color: string }[] = [
    { key: "mine",    label: "Me",      Icon: User,  color: meColor   },
    { key: "all",     label: "Both",    Icon: Users, color: bothColor },
    { key: "partner", label: "Partner", Icon: Heart, color: partColor },
  ];

  return (
    <div
      className={cn(
        "sticky top-16 z-30 flex items-center border-b border-white/5 px-4",
        "bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md",
      )}
    >
      {/* Me / Both / Partner tabs */}
      <div className="flex flex-1">
        {tabs.map(({ key, label, Icon, color }) => {
          const isActive = userFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onUserFilterChange(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold",
                "border-b-2 transition-colors",
                isActive ? "border-current" : "border-transparent text-white/40",
              )}
              style={isActive ? { color, borderColor: color } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Show completed eye toggle */}
      <button
        type="button"
        onClick={() => onShowCompletedChange(!showCompleted)}
        title={showCompleted ? "Hide completed" : `Show ${doneCount} done`}
        className={cn(
          "ml-3 flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs transition-colors",
          showCompleted
            ? "bg-emerald-500/30 text-emerald-300"
            : "bg-white/10 text-white/50 hover:bg-white/15",
        )}
      >
        {showCompleted ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <Circle className="w-3.5 h-3.5" />
        )}
        {!showCompleted && doneCount > 0 && (
          <span className="font-medium">{doneCount}</span>
        )}
      </button>
    </div>
  );
}
