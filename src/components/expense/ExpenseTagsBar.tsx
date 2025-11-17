"use client";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [theme, setTheme] = useState<"blue" | "pink">("blue");

  useEffect(() => {
    const colorTheme = localStorage.getItem("color-theme") || "blue";
    setTheme(colorTheme as "blue" | "pink");

    const handleThemeChange = () => {
      const newTheme = localStorage.getItem("color-theme") || "blue";
      setTheme(newTheme as "blue" | "pink");
    };

    window.addEventListener("storage", handleThemeChange);
    return () => window.removeEventListener("storage", handleThemeChange);
  }, []);

  const themeColors = {
    blue: {
      border: "border-[#3b82f6]/30",
      bg: "bg-[#0f1d2e]/95",
      accountBorder: "border-[#14b8a6]/30",
      accountBg: "bg-[#14b8a6]/10",
      accountHover: "hover:bg-[#14b8a6]/20",
      accountText: "text-[#14b8a6]",
      amountBorder: "border-[#3b82f6]/30",
      amountBg: "bg-[#3b82f6]/10",
      amountHover: "hover:bg-[#3b82f6]/20",
      amountText: "text-[#06b6d4]",
      categoryBorder: "border-[#22d3ee]/30",
      categoryBg: "bg-[#22d3ee]/10",
      categoryHover: "hover:bg-[#22d3ee]/20",
      categoryText: "text-[#22d3ee]",
      subcategoryBorder: "border-[#38bdf8]/30",
      subcategoryBg: "bg-[#38bdf8]/10",
      subcategoryText: "text-[#38bdf8]",
      dateBorder: "border-[#8b5cf6]/30",
      dateBg: "bg-[#8b5cf6]/10",
      dateHover: "hover:bg-[#8b5cf6]/20",
      dateIcon: "text-[#a78bfa]",
      labelText: "text-[#38bdf8]/80",
      popoverBg: "bg-[#1a2942]",
      popoverBorder: "border-[#3b82f6]/20",
      buttonBg: "bg-[#0f1d2e]",
      buttonBorder: "border-[#3b82f6]/20",
      buttonText: "text-[#06b6d4]",
      buttonHover: "hover:bg-[#3b82f6]/10",
    },
    pink: {
      border: "border-[#ec4899]/30",
      bg: "bg-[#1a0a14]/95",
      accountBorder: "border-[#f472b6]/30",
      accountBg: "bg-[#f472b6]/10",
      accountHover: "hover:bg-[#f472b6]/20",
      accountText: "text-[#f472b6]",
      amountBorder: "border-[#ec4899]/30",
      amountBg: "bg-[#ec4899]/10",
      amountHover: "hover:bg-[#ec4899]/20",
      amountText: "text-[#ec4899]",
      categoryBorder: "border-[#f9a8d4]/30",
      categoryBg: "bg-[#f9a8d4]/10",
      categoryHover: "hover:bg-[#f9a8d4]/20",
      categoryText: "text-[#f9a8d4]",
      subcategoryBorder: "border-[#fbbf24]/30",
      subcategoryBg: "bg-[#fbbf24]/10",
      subcategoryText: "text-[#fbbf24]",
      dateBorder: "border-[#c084fc]/30",
      dateBg: "bg-[#c084fc]/10",
      dateHover: "hover:bg-[#c084fc]/20",
      dateIcon: "text-[#e9d5ff]",
      labelText: "text-[#fbbf24]/80",
      popoverBg: "bg-[#2d1b29]",
      popoverBorder: "border-[#ec4899]/20",
      buttonBg: "bg-[#1a0a14]",
      buttonBorder: "border-[#ec4899]/20",
      buttonText: "text-[#f472b6]",
      buttonHover: "hover:bg-[#ec4899]/10",
    },
  };

  const colors = themeColors[theme];

  return (
    <div
      className={`fixed bottom-16 left-0 right-0 border-t ${colors.border} ${colors.bg} px-3 py-2.5 shadow-2xl z-40 min-h-[60px] slide-in-from-bottom backdrop-blur-md`}
    >
      <div className="flex flex-wrap gap-1.5">
        {selectedAccount && (
          <button
            onClick={onAccountClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card ${colors.accountBorder} ${colors.accountBg} ${colors.accountHover} hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in`}
          >
            <span className={`text-[10px] ${colors.labelText}`}>Account</span>
            <span className={`font-semibold text-xs ${colors.accountText}`}>
              {selectedAccount.name}
            </span>
          </button>
        )}

        {amount && (
          <button
            onClick={onAmountClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card ${colors.amountBorder} ${colors.amountBg} ${colors.amountHover} hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in`}
          >
            <span className={`text-[10px] ${colors.labelText}`}>Amount</span>
            <span className={`font-bold text-xs ${colors.amountText}`}>
              ${amount}
            </span>
          </button>
        )}

        {selectedCategory && (
          <button
            onClick={onCategoryClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card ${colors.categoryBorder} ${colors.categoryBg} ${colors.categoryHover} hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in`}
          >
            <span className={`text-[10px] ${colors.labelText}`}>Category</span>
            <span className={`font-semibold text-xs ${colors.categoryText}`}>
              {selectedCategory.icon} {selectedCategory.name}
            </span>
          </button>
        )}

        {selectedSubcategory && (
          <button
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card ${colors.subcategoryBorder} ${colors.subcategoryBg} cursor-default quick-scale-in`}
          >
            <span className={`text-[10px] ${colors.labelText}`}>
              Subcategory
            </span>
            <span className={`font-semibold text-xs ${colors.subcategoryText}`}>
              {selectedSubcategory.name}
            </span>
          </button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              suppressHydrationWarning
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full neo-card ${colors.dateBorder} ${colors.dateBg} ${colors.dateHover} hover:scale-105 active:scale-95 transition-all duration-150 quick-scale-in`}
            >
              <CalendarIcon className={`w-3.5 h-3.5 ${colors.dateIcon}`} />
              <span className={`text-[10px] ${colors.labelText}`}>Date</span>
              <span className={`font-semibold text-xs ${colors.dateIcon}`}>
                {format(date, "MMM d")}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className={`w-auto p-0 ${colors.popoverBg} ${colors.popoverBorder}`}
            align="start"
          >
            <div className={`p-2 space-y-1.5 border-b ${colors.popoverBorder}`}>
              <button
                onClick={() => {
                  const today = new Date();
                  onDateChange(today);
                }}
                className={`w-full px-2.5 py-1.5 text-xs rounded-lg neo-card ${colors.buttonBg} ${colors.buttonBorder} ${colors.buttonText} ${colors.buttonHover} transition-all`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const yesterday = subDays(new Date(), 1);
                  onDateChange(yesterday);
                }}
                className={`w-full px-2.5 py-1.5 text-xs rounded-lg neo-card ${colors.buttonBg} ${colors.buttonBorder} ${colors.buttonText} ${colors.buttonHover} transition-all`}
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
  );
}
