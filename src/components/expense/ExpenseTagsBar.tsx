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
  const wrapperStyles: CSSProperties = {
    bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_NAV_HEIGHT + TAGS_BAR_GAP}px)`,
  };

  const barStyles: CSSProperties = {
    minHeight: `${TAGS_BAR_HEIGHT}px`,
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4 pointer-events-none"
      style={wrapperStyles}
    >
      <div
        className="mx-auto max-w-[520px] pointer-events-auto rounded-[26px] border border-[#1a2942] bg-bg-dark/95 px-3 py-2.5 shadow-2xl slide-in-from-bottom backdrop-blur-xl"
        style={barStyles}
      >
        <div className="flex flex-wrap gap-1.5">
          {selectedAccount && (
            <button
              onClick={onAccountClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-[#22d3ee]/30 bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in"
            >
              <span className="text-[10px] text-[#06b6d4]/80">Account</span>
              <span className="font-semibold text-xs text-[#22d3ee]">
                {selectedAccount.name}
              </span>
            </button>
          )}

          {amount && (
            <button
              onClick={onAmountClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-[#22d3ee]/30 bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in"
            >
              <span className="text-[10px] text-[#06b6d4]/80">Amount</span>
              <span className="font-bold text-xs text-[#22d3ee]">
                ${amount}
              </span>
            </button>
          )}

          {selectedCategory && (
            <button
              onClick={onCategoryClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-secondary/30 bg-secondary/10 hover:bg-secondary/20 hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in"
            >
              <span className="text-[10px] text-[#06b6d4]/80">Category</span>
              <span className="font-semibold text-xs text-secondary">
                {selectedCategory.icon} {selectedCategory.name}
              </span>
            </button>
          )}

          {selectedSubcategory && (
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-accent/30 bg-accent/10 cursor-default quick-scale-in">
              <span className="text-[10px] text-[#06b6d4]/80">Subcategory</span>
              <span className="font-semibold text-xs text-accent">
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
                <span className="text-[10px] text-[#06b6d4]/80">Date</span>
                <span className="font-semibold text-xs text-purple">
                  {format(date, "MMM d")}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 bg-bg-card-custom border-[#1a2942]"
              align="start"
            >
              <div className="p-2 space-y-1.5 border-b border-[#1a2942]/50">
                <button
                  onClick={() => {
                    const today = new Date();
                    onDateChange(today);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg neo-card bg-bg-medium border-[#1a2942] text-secondary hover:bg-primary/10 transition-all"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const yesterday = subDays(new Date(), 1);
                    onDateChange(yesterday);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg neo-card bg-bg-medium border-[#1a2942] text-secondary hover:bg-primary/10 transition-all"
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
