"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type WidgetCardProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  /** Shows hover state and pointer cursor on clickable chart elements */
  interactive?: boolean;
  /** Shows a filter badge when this widget is actively filtering */
  filterActive?: boolean;
  /** Callback to clear filters originating from this widget */
  onFilterReset?: () => void;
};

export default function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className,
  noPadding,
  interactive,
  filterActive,
  onFilterReset,
}: WidgetCardProps) {
  const tc = useThemeClasses();

  return (
    <div
      className={cn(
        "neo-card rounded-xl overflow-hidden",
        interactive && "group/widget",
        filterActive && "ring-1 ring-cyan-500/30",
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              tc.text,
            )}
          >
            {title}
          </h3>
          {filterActive && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/15 text-cyan-400 uppercase tracking-wider shrink-0">
              ★ filtered
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {filterActive && onFilterReset && (
            <button
              onClick={onFilterReset}
              className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
              title="Clear widget filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          {action && <div>{action}</div>}
        </div>
      </div>
      {subtitle && (
        <p className="text-[10px] text-white/40 px-4 -mt-0.5 mb-1">
          {subtitle}
        </p>
      )}
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
