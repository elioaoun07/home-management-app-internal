/**
 * NotificationBell Component
 * Calm, ambient notification bell with badge counter.
 * Features:
 * - Finite on-arrival ring (plays once when a new notification lands, then rests)
 * - Honors prefers-reduced-motion (static dot/count, no animation)
 * - Checkmark celebration when all caught up
 * - Calmer themed badge color; red reserved for genuinely urgent unread
 */
"use client";

import { AlertBellIcon } from "@/components/icons/FuturisticIcons";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const { data, isLoading } = useUnreadNotificationCount();
  const unreadCount = data?.count ?? 0;
  const hasUrgent = data?.hasUrgent ?? false;
  const [showCelebration, setShowCelebration] = useState(false);
  const [justArrived, setJustArrived] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevCountRef = useRef<number | null>(null);
  const themeClasses = useThemeClasses();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Detect when we go from having notifications to being caught up,
  // and when a *new* notification arrives (count went up) — the only
  // moment the bell should animate. Merely staying unread stays at rest.
  useEffect(() => {
    const prevCount = prevCountRef.current;

    if (prevCount !== null && prevCount > 0 && unreadCount === 0) {
      setShowCelebration(true);
      prevCountRef.current = unreadCount;
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }

    if (prevCount !== null && unreadCount > prevCount && !reducedMotion) {
      setJustArrived(true);
      prevCountRef.current = unreadCount;
      const timer = setTimeout(() => setJustArrived(false), 1000);
      return () => clearTimeout(timer);
    }

    prevCountRef.current = unreadCount;
  }, [unreadCount, reducedMotion]);

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
      aria-label={
        hasNotifications
          ? `Notifications, ${unreadCount} unread${hasUrgent ? ", urgent" : ""}`
          : "Notifications, all caught up"
      }
    >
      {/* Bell Icon — rings once on arrival, then rests (calm, not an alarm) */}
      <div
        className={cn(
          "relative transition-transform duration-300 flex items-center justify-center",
          justArrived && "animate-notification-ring"
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

        {/* Notification dot/badge — calm themed accent; red only when genuinely urgent */}
        {hasNotifications && !showCelebration && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center",
              "min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold",
              hasUrgent
                ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
                : `${themeClasses.badgeBg} ${themeClasses.badgeText} shadow-md shadow-black/20`,
              !reducedMotion && "animate-notification-badge"
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

      {/* Loading indicator */}
      {isLoading && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" />
      )}
    </button>
  );
}
