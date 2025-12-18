/**
 * NotificationBell Component
 * Animated notification bell with badge counter
 * Features:
 * - Pulse animation when there are new notifications
 * - Checkmark celebration when all caught up
 * - Badge with unread count
 */
"use client";

import { AlertBellIcon } from "@/components/icons/FuturisticIcons";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

type NotificationBellProps = {
  onClick?: () => void;
  className?: string;
  size?: number;
};

export default function NotificationBell({
  onClick,
  className,
  size = 22,
}: NotificationBellProps) {
  const { data: unreadCount = 0, isLoading } = useUnreadNotificationCount();
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevCount, setPrevCount] = useState<number | null>(null);
  const themeClasses = useThemeClasses();

  // Detect when we go from having notifications to being caught up
  useEffect(() => {
    if (prevCount !== null && prevCount > 0 && unreadCount === 0) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
    setPrevCount(unreadCount);
  }, [unreadCount, prevCount]);

  const hasNotifications = unreadCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      suppressHydrationWarning
      className={cn(
        "relative p-2 h-10 w-10 flex items-center justify-center rounded-lg transition-all duration-300",
        hasNotifications
          ? `${themeClasses.bgActive} ${themeClasses.borderActive} ${themeClasses.shadowActive}`
          : `${themeClasses.bgSurface} ${themeClasses.border}`,
        "backdrop-blur-sm",
        themeClasses.bgHover,
        className
      )}
      aria-label={`Notifications${hasNotifications ? ` (${unreadCount} unread)` : ""}`}
    >
      {/* Bell Icon with animation */}
      <div
        className={cn(
          "relative transition-transform duration-300 flex items-center justify-center",
          hasNotifications && "animate-notification-ring"
        )}
      >
        {showCelebration ? (
          // Checkmark when caught up
          <div className="relative w-5 h-5 flex items-center justify-center animate-check-draw">
            <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-circle-draw" />
            <Check className="w-3 h-3 text-green-400" strokeWidth={3} />
          </div>
        ) : (
          // Bell icon from app's icon library
          <AlertBellIcon
            size={size}
            showDot={false}
            className={cn(
              "transition-all duration-500",
              hasNotifications
                ? `${themeClasses.text} scale-110`
                : themeClasses.textFaint,
              hasNotifications && themeClasses.glow
            )}
          />
        )}

        {/* Notification dot/badge */}
        {hasNotifications && !showCelebration && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center",
              "min-w-[16px] h-[16px] px-1 rounded-full",
              "bg-red-500 text-white text-[9px] font-bold",
              "shadow-lg shadow-red-500/40",
              "animate-notification-badge"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}

        {/* Celebration sparkles */}
        {showCelebration && (
          <div className="absolute inset-0 pointer-events-none">
            <span className="absolute -top-1 -left-1 w-1.5 h-1.5 bg-green-400 rounded-full animate-sparkle-1" />
            <span className="absolute -top-2 right-0 w-1 h-1 bg-emerald-400 rounded-full animate-sparkle-2" />
            <span className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-green-300 rounded-full animate-sparkle-3" />
            <span className="absolute bottom-0 -left-2 w-1 h-1 bg-teal-400 rounded-full animate-sparkle-4" />
          </div>
        )}
      </div>

      {/* Pulse ring effect when there are notifications */}
      {hasNotifications && (
        <span className="absolute inset-0 rounded-lg animate-notification-pulse bg-primary/20 pointer-events-none" />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" />
      )}
    </button>
  );
}
