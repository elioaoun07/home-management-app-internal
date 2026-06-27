"use client";

import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type BlurredAmountProps = {
  children: ReactNode;
  className?: string;
  /** Additional blur intensity (default: blur-md) */
  blurIntensity?: "sm" | "md" | "lg";
  /**
   * Force the blur on permanently, independent of the global privacy toggle.
   * Used for a partner's PRIVATE transaction amount: the viewer (non-owner)
   * must never be able to reveal it with the eye toggle — only the owner can
   * see it. The amount still occupies the layout so it counts in totals.
   */
  forceBlur?: boolean;
};

/**
 * Wrapper component that applies privacy blur to any content (typically amounts/numbers).
 * Uses the PrivacyBlurContext to determine blur state.
 * Includes smooth transition animation.
 *
 * IMPORTANT: This uses filter blur which works with all text including gradient text.
 */
export default function BlurredAmount({
  children,
  className,
  blurIntensity = "md",
  forceBlur = false,
}: BlurredAmountProps) {
  const { isBlurred } = usePrivacyBlur();
  const blurred = isBlurred || forceBlur;

  const blurValue = {
    sm: "4px",
    md: "8px",
    lg: "12px",
  }[blurIntensity];

  return (
    <span
      className={cn(
        "transition-[filter] duration-300 ease-out inline-block",
        className,
      )}
      style={{
        filter: blurred ? `blur(${blurValue})` : "none",
        // Prevent text selection when blurred for extra privacy
        WebkitUserSelect: blurred ? "none" : "auto",
        userSelect: blurred ? "none" : "auto",
      }}
      title={forceBlur ? "Private — only your partner can see this" : undefined}
    >
      {children}
    </span>
  );
}
