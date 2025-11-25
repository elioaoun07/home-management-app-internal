"use client";

import { CheckIcon, PlusIcon } from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useState } from "react";

type Props = {
  disabled?: boolean;
  onSubmit?: () => Promise<void>;
};

export default function AddExpenseButton({ disabled = true, onSubmit }: Props) {
  const themeClasses = useThemeClasses();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleClick = async () => {
    if (!onSubmit || disabled) return;

    setIsSubmitting(true);
    try {
      await onSubmit();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error("Error submitting expense:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      disabled={disabled || isSubmitting}
      onClick={handleClick}
      className="w-full h-12 text-base font-semibold transition-all group"
      size="lg"
    >
      {isSubmitting ? (
        <span className="flex items-center gap-2">
          <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          Adding Expense...
        </span>
      ) : showSuccess ? (
        <span className="flex items-center gap-2 animate-in fade-in">
          <CheckIcon className="w-5 h-5 drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
          Added Successfully!
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <PlusIcon
            className={`w-5 h-5 transition-transform group-hover:rotate-90 ${themeClasses.iconGlow}`}
          />
          Add Expense
        </span>
      )}
    </Button>
  );
}
