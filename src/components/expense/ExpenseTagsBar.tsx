"use client";

import { CalendarIcon } from "@/components/icons/FuturisticIcons";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MOBILE_NAV_HEIGHT,
  TAGS_BAR_GAP,
  TAGS_BAR_HEIGHT,
} from "@/constants/layout";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { type CSSProperties } from "react";

interface ExpenseTagsBarProps {
  selectedAccount: { id: string; name: string } | undefined;
  amount: string;
  selectedCategory:
    | { id: string; name: string; icon?: string | null }
    | undefined;
  selectedSubcategory: { id: string; name: string } | undefined;
  date: Date;
  onAccountClick: () => void;
  onAmountClick: () => void;
  onCategoryClick: () => void;
  onDateChange: (date: Date) => void;
}

export default function ExpenseTagsBar({
  selectedAccount,
  amount,
  selectedCategory,
  selectedSubcategory,
  date,
  onAccountClick,
  onAmountClick,
  onCategoryClick,
  onDateChange,
}: ExpenseTagsBarProps) {
  const themeClasses = useThemeClasses();
  const wrapperStyles: CSSProperties = {
    bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_NAV_HEIGHT + TAGS_BAR_GAP}px)`,
  };

  const barStyles: CSSProperties = {
    minHeight: `${TAGS_BAR_HEIGHT}px`,
  };

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
          {selectedAccount && (
            <button
              onClick={onAccountClick}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
                themeClasses.border,
                themeClasses.bgSurface,
                themeClasses.bgHover
              )}
            >
              <span className={cn("text-[10px]", themeClasses.textMuted)}>
                Account
              </span>
              <span
                className={cn(
                  "font-semibold text-xs",
                  themeClasses.textHighlight
                )}
              >
                {selectedAccount.name}
              </span>
            </button>
          )}

          {amount && (
            <button
              onClick={onAmountClick}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
                themeClasses.border,
                themeClasses.bgSurface,
                themeClasses.bgHover
              )}
            >
              <span className={cn("text-[10px]", themeClasses.textMuted)}>
                Amount
              </span>
              <span
                className={cn("font-bold text-xs", themeClasses.textHighlight)}
              >
                ${amount}
              </span>
            </button>
          )}

          {selectedCategory && (
            <button
              onClick={onCategoryClick}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in",
                themeClasses.border,
                themeClasses.bgSurface,
                themeClasses.bgHover
              )}
            >
              <span className={cn("text-[10px]", themeClasses.textMuted)}>
                Category
              </span>
              <span
                className={cn(
                  "font-semibold text-xs",
                  themeClasses.textHighlight
                )}
              >
                {selectedCategory.icon} {selectedCategory.name}
              </span>
            </button>
          )}

          {selectedSubcategory && (
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card cursor-default quick-scale-in",
                themeClasses.border,
                themeClasses.bgSurface
              )}
            >
              <span className={cn("text-[10px]", themeClasses.textMuted)}>
                Subcategory
              </span>
              <span
                className={cn(
                  "font-semibold text-xs",
                  themeClasses.textHighlight
                )}
              >
                {selectedSubcategory.name}
              </span>
            </button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <button
                suppressHydrationWarning
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-purple/30 bg-purple/10 hover:bg-purple/20 hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-purple" />
                <span className={`text-[10px] ${themeClasses.labelTextMuted}`}>
                  Date
                </span>
                <span className="font-semibold text-xs text-purple">
                  {format(date, "MMM d")}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={`w-auto p-0 bg-bg-card-custom ${themeClasses.border}`}
              align="start"
            >
              <div
                className={`p-2 space-y-1.5 border-b ${themeClasses.border} opacity-50`}
              >
                <button
                  onClick={() => {
                    const today = new Date();
                    onDateChange(today);
                  }}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg neo-card bg-bg-medium ${themeClasses.border} text-secondary hover:bg-primary/10 transition-all`}
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const yesterday = subDays(new Date(), 1);
                    onDateChange(yesterday);
                  }}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg neo-card bg-bg-medium ${themeClasses.border} text-secondary hover:bg-primary/10 transition-all`}
                >
                  Yesterday
                </button>
              </div>
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => newDate && onDateChange(newDate)}
                className="rounded-md border-0"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
