"use client";

// The one Transfer/Transaction decision, everywhere it appears — the
// Transfers-tab card and the shared row editor (GroupSheet) both render this
// SAME control, so flipping "did this move, or did I spend it?" always looks
// and behaves identically no matter which surface it's tapped from.

import { TransferIcon } from "@/components/icons/FuturisticIcons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";

export function TransferToggle({
  checked,
  onChange,
  className,
}: {
  /** true = Transfer, false = Transaction. */
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  const tc = useThemeClasses();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={
        checked
          ? "Transfer — tap to log as a transaction instead"
          : "Transaction — tap to mark as a transfer instead"
      }
      onClick={onChange}
      className={cn(
        "relative inline-flex items-center h-7 w-12 rounded-full shrink-0 transition-colors",
        checked ? tc.buttonPrimary : tc.pillBg,
        className,
      )}
    >
      {/* Sliding knob: round blue-ish grey thumb when OFF, lit icon when ON */}
      <span
        className={cn(
          "absolute left-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-300",
          checked ? "translate-x-4 bg-transparent" : "bg-slate-500/30",
        )}
      >
        <TransferIcon
          size={16}
          className={checked ? cn("text-white", tc.iconGlow) : tc.textMuted}
        />
      </span>
    </button>
  );
}
