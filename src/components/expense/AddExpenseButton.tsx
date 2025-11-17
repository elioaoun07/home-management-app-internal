"use client";

import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import { useState } from "react";

type Props = {
  disabled?: boolean;
  onSubmit?: () => Promise<void>;
};

export default function AddExpenseButton({ disabled = true, onSubmit }: Props) {
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
          <Check className="w-5 h-5" />
          Added Successfully!
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
          Add Expense
        </span>
      )}
    </Button>
  );
}
