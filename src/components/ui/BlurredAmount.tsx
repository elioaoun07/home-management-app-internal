"use client";

import { usePrivacyBlur } from "@/contexts/PrivacyBlurContext";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type BlurredAmountProps = {
  children: ReactNode;
  className?: string;
  /** Additional blur intensity (default: blur-md) */
  blurIntensity?: "sm" | "md" | "lg";
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
}: BlurredAmountProps) {
  const { isBlurred } = usePrivacyBlur();

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
        filter: isBlurred ? `blur(${blurValue})` : "none",
        // Prevent text selection when blurred for extra privacy
        WebkitUserSelect: isBlurred ? "none" : "auto",
        userSelect: isBlurred ? "none" : "auto",
      }}
    >
      {children}
    </span>
  );
}
