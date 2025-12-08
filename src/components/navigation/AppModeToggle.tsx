"use client";

import { useAppMode, type AppMode } from "@/contexts/AppModeContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * AppModeToggle - A pill-shaped toggle to switch between Budget and Items modes
 * Designed to be placed in the dashboard header
 */

const modeConfig: Record<AppMode, { label: string; icon: React.ReactNode }> = {
  budget: {
    label: "Budget",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  items: {
    label: "Items",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v4" />
        <path d="m16.2 7.8 2.9-2.9" />
        <path d="M18 12h4" />
        <path d="m16.2 16.2 2.9 2.9" />
        <path d="M12 18v4" />
        <path d="m4.9 19.1 2.9-2.9" />
        <path d="M2 12h4" />
        <path d="m4.9 4.9 2.9 2.9" />
      </svg>
    ),
  },
};

interface AppModeToggleProps {
  className?: string;
}

export default function AppModeToggle({ className }: AppModeToggleProps) {
  const { appMode, setAppMode, isBudgetMode } = useAppMode();
  const themeClasses = useThemeClasses();

  return (
    <div
      className={cn(
        "relative flex items-center p-1 rounded-full",
        "bg-black/20 backdrop-blur-sm",
        "border border-white/10",
        className
      )}
    >
      {/* Animated background pill */}
      <motion.div
        className={cn(
          "absolute h-[calc(100%-8px)] rounded-full",
          "neo-gradient"
        )}
        initial={false}
        animate={{
          x: isBudgetMode ? 4 : "calc(100% - 4px)",
          width: "calc(50% - 4px)",
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        style={{
          top: "4px",
        }}
      />

      {/* Budget Mode Button */}
      <button
        type="button"
        onClick={() => setAppMode("budget")}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "text-xs font-semibold transition-colors duration-200",
          isBudgetMode ? "text-white" : "text-white/60 hover:text-white/80"
        )}
      >
        {modeConfig.budget.icon}
        <span className="hidden sm:inline">{modeConfig.budget.label}</span>
      </button>

      {/* Items Mode Button */}
      <button
        type="button"
        onClick={() => setAppMode("items")}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "text-xs font-semibold transition-colors duration-200",
          !isBudgetMode ? "text-white" : "text-white/60 hover:text-white/80"
        )}
      >
        {modeConfig.items.icon}
        <span className="hidden sm:inline">{modeConfig.items.label}</span>
      </button>
    </div>
  );
}

/**
 * ViewModeSelector - Toggle between Agenda, Timeline, and Calendar views
 */

type ViewMode = "agenda" | "schedule" | "calendar";

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

const viewModeConfig: Record<
  ViewMode,
  { label: string; icon: React.ReactNode }
> = {
  agenda: {
    label: "Agenda",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  schedule: {
    label: "Timeline",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  calendar: {
    label: "Calendar",
    icon: (
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
};

export function ViewModeSelector({
  viewMode,
  onViewModeChange,
  className,
}: ViewModeSelectorProps) {
  const { isItemsMode } = useAppMode();
  const themeClasses = useThemeClasses();

  // Only show when in items mode
  if (!isItemsMode) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-xl",
        "bg-black/20 backdrop-blur-sm",
        "border border-white/10",
        className
      )}
    >
      {(Object.keys(viewModeConfig) as ViewMode[]).map((mode) => {
        const isActive = viewMode === mode;
        const config = viewModeConfig[mode];

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg",
              "text-[10px] font-medium transition-all duration-200",
              isActive
                ? "neo-gradient text-white shadow-lg"
                : "text-white/60 hover:text-white/80 hover:bg-white/5"
            )}
          >
            {config.icon}
            <span className="hidden xs:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
