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
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
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
      className="fixed left-0 right-0 z-30 px-4 pointer-events-none"
      style={wrapperStyles}
    >
      <div
        className={`mx-auto max-w-[520px] pointer-events-auto rounded-full ${themeClasses.pillBg} px-4 py-2 shadow-lg backdrop-blur-md border ${themeClasses.border}`}
        style={barStyles}
      >
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {selectedAccount && (
            <button
              onClick={onAccountClick}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${themeClasses.pillBg} ${themeClasses.pillBgHover} active:scale-95 transition-all duration-150`}
            >
              <span className={`text-[10px] ${themeClasses.textFaint}`}>Account</span>
              <span className={`font-semibold text-xs ${themeClasses.text}`}>
                {selectedAccount.name}
              </span>
            </button>
          )}

          {amount && (
            <button
              onClick={onAmountClick}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${themeClasses.pillBg} ${themeClasses.pillBgHover} active:scale-95 transition-all duration-150`}
            >
              <span className={`text-[10px] ${themeClasses.textFaint}`}>Amount</span>
              <span className="font-bold text-xs text-emerald-400">
                ${amount}
              </span>
            </button>
          )}

          {selectedCategory &&
            (() => {
              const CategoryIcon = getCategoryIcon(selectedCategory.name);
              return (
                <button
                  onClick={onCategoryClick}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${themeClasses.pillBg} ${themeClasses.pillBgHover} active:scale-95 transition-all duration-150`}
                >
                  <CategoryIcon className="w-3 h-3 text-amber-400" />
                  <span className={`font-semibold text-xs ${themeClasses.textHighlight}`}>
                    {selectedCategory.name}
                  </span>
                </button>
              );
            })()}

          {selectedSubcategory &&
            (() => {
              const SubcategoryIcon = getCategoryIcon(selectedSubcategory.name);
              return (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${themeClasses.pillBg}`}>
                  <SubcategoryIcon className={`w-2.5 h-2.5 ${themeClasses.textFaint}`} />
                  <span className={`text-[10px] ${themeClasses.textMuted}`}>
                    {selectedSubcategory.name}
                  </span>
                </span>
              );
            })()}

          <Popover>
            <PopoverTrigger asChild>
              <button
                suppressHydrationWarning
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 active:scale-95 transition-all duration-150"
              >
                <CalendarIcon className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] text-purple-300">Date</span>
                <span className="font-semibold text-xs text-purple-300">
                  {format(date, "MMM d")}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={`w-auto p-0 ${themeClasses.modalBg} ${themeClasses.modalBorder}`}
              align="start"
            >
              <div className={`p-2 space-y-1.5 border-b ${themeClasses.border}`}>
                <button
                  onClick={() => {
                    const today = new Date();
                    onDateChange(today);
                  }}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg ${themeClasses.bgSurface} ${themeClasses.textMuted} ${themeClasses.hoverBgSubtle} transition-all`}
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const yesterday = subDays(new Date(), 1);
                    onDateChange(yesterday);
                  }}
                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg ${themeClasses.bgSurface} ${themeClasses.textMuted} ${themeClasses.hoverBgSubtle} transition-all`}
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
