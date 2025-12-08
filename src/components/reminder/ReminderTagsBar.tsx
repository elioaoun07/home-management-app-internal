"use client";

import {
  MOBILE_NAV_HEIGHT,
  TAGS_BAR_GAP,
  TAGS_BAR_HEIGHT,
} from "@/constants/layout";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { type CSSProperties } from "react";

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

interface ReminderTagsBarProps {
  title: string;
  detectedItemType: "reminder" | "event";
  selectedCategories: Array<{ id: string; name: string; color_hex: string }>;
  priority: string;
  dueDate?: string;
  dueTime?: string;
  startDate?: string;
  startTime?: string;
  date: Date;
  onTitleClick: () => void;
  onCategoriesClick: () => void;
  onDateChange: (date: Date) => void;
  onTypeClick: () => void;
  onDateClick: () => void;
  onPriorityClick: () => void;
}

export default function ReminderTagsBar({
  title,
  detectedItemType,
  selectedCategories,
  priority,
  dueDate,
  dueTime,
  startDate,
  startTime,
  date,
  onTitleClick,
  onCategoriesClick,
  onDateChange,
  onTypeClick,
  onDateClick,
  onPriorityClick,
}: ReminderTagsBarProps) {
  const themeClasses = useThemeClasses();
  const wrapperStyles: CSSProperties = {
    bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_NAV_HEIGHT + TAGS_BAR_GAP}px)`,
  };

  const barStyles: CSSProperties = {
    minHeight: `${TAGS_BAR_HEIGHT}px`,
  };

  const hasDateInfo = !!(dueDate || dueTime || startDate || startTime);

  return (
    <div
      className="fixed left-0 right-0 z-[50] px-4 pointer-events-none"
      style={wrapperStyles}
    >
      <div
        className={cn(
          "mx-auto max-w-[520px] pointer-events-auto rounded-[26px] border bg-bg-dark/95 px-3 py-2.5 shadow-2xl slide-in-from-bottom backdrop-blur-xl",
          themeClasses.border
        )}
        style={barStyles}
      >
        <div className="flex flex-wrap gap-1.5">
          {/* Item Type Tag */}
          <button
            onClick={onTypeClick}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
              themeClasses.border,
              themeClasses.bgSurface,
              themeClasses.bgHover
            )}
          >
            {detectedItemType === "reminder" ? (
              <BellIcon className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <CalendarIcon className="w-3.5 h-3.5 text-pink-400" />
            )}
            <span className={cn("text-[10px]", themeClasses.textMuted)}>
              Type
            </span>
            <span
              className={cn(
                "font-semibold text-xs capitalize",
                detectedItemType === "reminder"
                  ? "text-cyan-400"
                  : "text-pink-400"
              )}
            >
              {detectedItemType}
            </span>
          </button>

          {/* Title Tag */}
          {title && (
            <button
              onClick={onTitleClick}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
                themeClasses.border,
                themeClasses.bgSurface,
                themeClasses.bgHover
              )}
            >
              <span className={cn("text-[10px]", themeClasses.textMuted)}>
                Title
              </span>
              <span
                className={cn(
                  "font-semibold text-xs max-w-[120px] truncate",
                  themeClasses.textHighlight
                )}
              >
                {title}
              </span>
            </button>
          )}

          {/* Categories Tag */}
          {selectedCategories.length > 0 && (
            <button
              onClick={onCategoriesClick}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
                themeClasses.border,
                themeClasses.bgSurface,
                themeClasses.bgHover
              )}
            >
              <span className={cn("text-[10px]", themeClasses.textMuted)}>
                Categories
              </span>
              <div className="flex items-center gap-1">
                {selectedCategories.slice(0, 3).map((cat) => (
                  <span
                    key={cat.id}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color_hex }}
                  />
                ))}
              </div>
              <span
                className={cn(
                  "font-semibold text-xs",
                  themeClasses.textHighlight
                )}
              >
                {selectedCategories.length > 1
                  ? `${selectedCategories.length} selected`
                  : selectedCategories[0].name}
              </span>
            </button>
          )}

          {/* Priority Tag */}
          {priority !== "normal" && (
            <button
              onClick={onPriorityClick}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
                themeClasses.border,
                themeClasses.bgSurface,
                themeClasses.bgHover
              )}
            >
              <span className={cn("text-[10px]", themeClasses.textMuted)}>
                Priority
              </span>
              <span
                className={cn("font-semibold text-xs capitalize", {
                  "text-gray-400": priority === "low",
                  "text-orange-400": priority === "high",
                  "text-red-400": priority === "urgent",
                })}
              >
                {priority}
              </span>
            </button>
          )}

          {/* Date Tag */}
          <button
            onClick={onDateClick}
            suppressHydrationWarning
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
              hasDateInfo
                ? "border-purple/30 bg-purple/10 hover:bg-purple/20"
                : `${themeClasses.border} ${themeClasses.bgSurface} ${themeClasses.bgHover}`
            )}
          >
            <CalendarIcon
              className={cn(
                "w-3.5 h-3.5",
                hasDateInfo ? "text-purple" : themeClasses.textMuted
              )}
            />
            <span className={cn("text-[10px]", themeClasses.textMuted)}>
              Date
            </span>
            <span
              className={cn(
                "font-semibold text-xs",
                hasDateInfo ? "text-purple" : themeClasses.textHighlight
              )}
            >
              {format(date, "MMM d")}
            </span>
            {hasDateInfo && (dueTime || startTime) && (
              <span className="font-semibold text-xs text-purple/80">
                {dueTime || startTime}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
