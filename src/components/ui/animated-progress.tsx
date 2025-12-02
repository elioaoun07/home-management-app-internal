"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface AnimatedProgressBarProps {
  value: number; // 0-100 percentage
  duration?: number;
  color?: string;
  bgColor?: string;
  height?: number;
  className?: string;
  showValue?: boolean;
}

export function AnimatedProgressBar({
  value,
  duration = 800,
  color = "#10b981",
  bgColor = "rgba(30, 41, 59, 0.8)",
  height = 8,
  className = "",
  showValue = false,
}: AnimatedProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const animationRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on first render - start from 0 and animate to value
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousValue.current = 0;
    }

    const startValue = previousValue.current;
    const endValue = Math.min(100, Math.max(0, value));
    const startTime = performance.now();

    if (startValue === endValue) return;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out-expo for smooth deceleration
      const easeOutExpo = 1 - Math.pow(2, -10 * progress);

      const currentValue = startValue + (endValue - startValue) * easeOutExpo;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height, backgroundColor: bgColor }}
      >
        <div
          className="h-full rounded-full transition-colors"
          style={{
            width: `${displayValue}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {showValue && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-slate-400 ml-2">
          {displayValue.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

interface AnimatedCategoryBarProps {
  amount: number;
  total: number;
  color: string;
  duration?: number;
  height?: number;
  className?: string;
}

export function AnimatedCategoryBar({
  amount,
  total,
  color,
  duration = 800,
  height = 6,
  className = "",
}: AnimatedCategoryBarProps) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;

  return (
    <AnimatedProgressBar
      value={percentage}
      color={color}
      duration={duration}
      height={height}
      className={className}
    />
  );
}

interface AnimatedComparisonBarProps {
  current: number;
  previous: number;
  currentColor?: string;
  previousColor?: string;
  duration?: number;
  className?: string;
}

export function AnimatedComparisonBar({
  current,
  previous,
  currentColor = "#3b82f6",
  previousColor = "rgba(100, 116, 139, 0.5)",
  duration = 800,
  className = "",
}: AnimatedComparisonBarProps) {
  const maxValue = Math.max(current, previous, 1);
  const currentPercentage = (current / maxValue) * 100;
  const previousPercentage = (previous / maxValue) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="space-y-1">
        <AnimatedProgressBar
          value={currentPercentage}
          color={currentColor}
          duration={duration}
          height={8}
        />
        <AnimatedProgressBar
          value={previousPercentage}
          color={previousColor}
          duration={duration}
          height={8}
        />
      </div>
    </div>
  );
}
