"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type WidgetCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

export default function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className,
  noPadding,
}: WidgetCardProps) {
  const tc = useThemeClasses();

  return (
    <div className={cn("neo-card rounded-xl overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div>
          <h3
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              tc.text,
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className={noPadding ? "" : "px-4 pb-4 pt-1"}>{children}</div>
    </div>
  );
}

/**
 * Skeleton placeholder for loading widgets
 */
export function WidgetSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="neo-card rounded-xl overflow-hidden animate-pulse">
      <div className="px-4 pt-3 pb-1">
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>
      <div className="px-4 pb-4 pt-1">
        <div className="rounded-lg bg-white/5" style={{ height }} />
      </div>
    </div>
  );
}
