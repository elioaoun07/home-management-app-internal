"use client";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useExpenseFormStore } from "@/lib/hooks/use-expense-form-store";
import { format, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";

export function ExpenseTags() {
  const {
    amount,
    selectedAccountId,
    selectedAccountName,
    selectedCategoryId,
    selectedCategoryName,
    selectedCategoryIcon,
    selectedSubcategoryId,
    selectedSubcategoryName,
    date,
    actions,
  } = useExpenseFormStore();

  const handleSetStep = (step: string) => {
    actions.setStep(step);
  };

  const handleSetDate = (newDate: Date | undefined) => {
    if (newDate) {
      actions.setDate(newDate);
    }
  };

  // We only want to show the tags if there's at least an amount or category selected,
  // and we are on a page that uses the expense form.
  // A simple check for amount is a good proxy for this.
  if (!amount) {
    return null;
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 border-t border-[#3b82f6]/30 bg-[#0f1d2e] px-3 py-2.5 shadow-2xl z-40 min-h-[60px]">
      <div className="flex flex-wrap gap-1.5">
        {/* Account Chip */}
        {selectedAccountId && (
          <button
            onClick={() => handleSetStep("account")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-[#14b8a6]/30 bg-[#14b8a6]/10 hover:bg-[#14b8a6]/20 active:scale-95 transition-all"
          >
            <span className="text-[10px] text-[#38bdf8]/80">Account</span>
            <span className="font-semibold text-xs text-[#14b8a6]">
              {selectedAccountName}
            </span>
          </button>
        )}

        {/* Amount Chip */}
        {amount && (
          <button
            onClick={() => handleSetStep("amount")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-[#3b82f6]/30 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 active:scale-95 transition-all"
          >
            <span className="text-[10px] text-[#38bdf8]/80">Amount</span>
            <span className="font-bold text-xs text-[#06b6d4]">${amount}</span>
          </button>
        )}

        {/* Category Chip */}
        {selectedCategoryId && (
          <button
            onClick={() => handleSetStep("category")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-[#22d3ee]/30 bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 active:scale-95 transition-all"
          >
            <span className="text-[10px] text-[#38bdf8]/80">Category</span>
            <span className="font-semibold text-xs text-[#22d3ee]">
              {selectedCategoryIcon} {selectedCategoryName}
            </span>
          </button>
        )}

        {/* Subcategory Chip */}
        {selectedSubcategoryId && (
          <button
            onClick={() => handleSetStep("subcategory")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-[#38bdf8]/30 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 active:scale-95 transition-all"
          >
            <span className="text-[10px] text-[#38bdf8]/80">Subcategory</span>
            <span className="font-semibold text-xs text-[#38bdf8]">
              {selectedSubcategoryName}
            </span>
          </button>
        )}

        {/* Date Chip */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              suppressHydrationWarning
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card border-[#8b5cf6]/30 bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 active:scale-95 transition-all"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#a78bfa]" />
              <span className="text-[10px] text-[#38bdf8]/80">Date</span>
              <span className="font-semibold text-xs text-[#a78bfa]">
                {format(date, "MMM d")}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 bg-[#1a2942] border-[#3b82f6]/20"
            align="start"
          >
            <div className="p-2 space-y-1.5 border-b border-[#3b82f6]/20">
              <button
                onClick={() => handleSetDate(new Date())}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-[#06b6d4] hover:bg-[#3b82f6]/10 transition-all"
              >
                Today
              </button>
              <button
                onClick={() => handleSetDate(subDays(new Date(), 1))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg neo-card bg-[#0f1d2e] border-[#3b82f6]/20 text-[#06b6d4] hover:bg-[#3b82f6]/10 transition-all"
              >
                Yesterday
              </button>
            </div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSetDate}
              className="rounded-md border-0"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
