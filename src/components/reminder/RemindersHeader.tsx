"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { itemsKeys } from "@/features/items/useItems";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────
export type UserFilter = "all" | "mine" | "partner";
export type RemindersPage = "focus" | "insights";

interface RemindersHeaderProps {
  userFilter: UserFilter;
  onUserFilterChange: (v: UserFilter) => void;
  activePage: RemindersPage;
  onPageChange: (p: RemindersPage) => void;
}

// ─── Inline Icons ─────────────────────────────────────────────────────────────
const UserIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const FocusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="8" strokeDasharray="4 4" />
  </svg>
);

const InsightsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 3v18h18" />
    <path d="M7 16l4-6 4 3 5-7" />
    <circle cx="20" cy="6" r="1.5" fill="currentColor" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.5 2v6h-6" />
    <path d="M2.5 22v-6h6" />
    <path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8" />
    <path d="M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function RemindersHeader({
  userFilter,
  onUserFilterChange,
  activePage,
  onPageChange,
}: RemindersHeaderProps) {
  const tc = useThemeClasses();
  const { theme: currentUserTheme } = useTheme();
  const queryClient = useQueryClient();
  const isFetchingCount = useIsFetching({ queryKey: itemsKeys.all });
  const isFetching = isFetchingCount > 0;

  const themeColor =
    currentUserTheme === "pink"
      ? { me: "#ec4899", partner: "#3b82f6" }
      : { me: "#3b82f6", partner: "#ec4899" };

  const pages: {
    key: RemindersPage;
    label: string;
    Icon: React.FC<{ className?: string }>;
  }[] = [
    { key: "focus", label: "Focus", Icon: FocusIcon },
    { key: "insights", label: "Insights", Icon: InsightsIcon },
  ];

  return (
    <div
      className={cn(
        "sticky top-14 z-30",
        "bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md",
        "border-b border-white/5",
      )}
    >
      {/* Row 1: Me / Both / Partner */}
      <div className="flex items-center border-b border-white/5">
        <button
          onClick={() => onUserFilterChange("mine")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            userFilter === "mine"
              ? "text-white"
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
          style={
            userFilter === "mine"
              ? { borderColor: themeColor.me, color: themeColor.me }
              : {}
          }
        >
          <UserIcon className="w-3.5 h-3.5" />
          Me
        </button>
        <button
          onClick={() => onUserFilterChange("all")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            userFilter === "all"
              ? `border-current ${tc.textActive}`
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
        >
          <UsersIcon className="w-3.5 h-3.5" />
          Both
        </button>
        <button
          onClick={() => onUserFilterChange("partner")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
            userFilter === "partner"
              ? "text-white"
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
          style={
            userFilter === "partner"
              ? { borderColor: themeColor.partner, color: themeColor.partner }
              : {}
          }
        >
          <HeartIcon className="w-3.5 h-3.5" />
          Partner
        </button>
      </div>

      {/* Row 2: Page tabs + refresh icon */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        {/* Page tabs */}
        <div className="flex gap-0.5 neo-card rounded-xl p-1 flex-1 min-w-0">
          {pages.map(({ key, label, Icon }) => {
            const isActive = activePage === key;
            return (
              <button
                key={key}
                onClick={() => onPageChange(key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "neo-gradient text-white shadow-sm"
                    : `${tc.text} hover:bg-white/5`,
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Refresh */}
        <button
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(5);
            queryClient.invalidateQueries({ queryKey: itemsKeys.all });
          }}
          disabled={isFetching}
          className={cn(
            "p-1.5 rounded-lg transition-colors flex-shrink-0",
            isFetching
              ? `${tc.bgActive} ${tc.textActive}`
              : `neo-card ${tc.text} hover:bg-white/5`,
          )}
          title="Refresh data"
        >
          <RefreshIcon
            className={cn("w-4 h-4", isFetching && "animate-spin")}
          />
        </button>
      </div>
    </div>
  );
}
