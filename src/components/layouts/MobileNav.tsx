/**
 * Mobile Bottom Navigation
 * Thumb-zone friendly navigation for mobile devices
 */
"use client";

import type { Template } from "@/components/expense/TemplateDrawer";
import TemplateDrawer from "@/components/expense/TemplateDrawer";
import { MOBILE_NAV_BOTTOM_GAP, MOBILE_NAV_HEIGHT } from "@/constants/layout";
import { cn } from "@/lib/utils";
import { BarChart3, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type CSSProperties, useRef, useState } from "react";

const navItems = [
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/expense", icon: Plus, label: "Add", primary: true },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);

  // Hide on auth pages
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/reset-password" ||
    pathname === "/welcome" ||
    pathname === "/"
  ) {
    return null;
  }

  const handleTouchStart = () => {
    setIsLongPress(false);
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setShowTemplateDrawer(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    if (!isLongPress) {
      // Normal tap - navigate to expense page
      router.push("/expense");
    }
    e.preventDefault();
  };

  const handleTemplateSelect = (template: Template) => {
    // Navigate to expense page with template data
    const params = new URLSearchParams({
      template: template.id,
    });
    router.push(`/expense?${params.toString()}`);
  };

  const containerStyles: CSSProperties = {
    bottom: `calc(env(safe-area-inset-bottom) + ${MOBILE_NAV_BOTTOM_GAP}px)`,
  };

  const navSurfaceStyles: CSSProperties = {
    height: `${MOBILE_NAV_HEIGHT}px`,
  };

  return (
    <>
      {/* Bottom Navigation */}
      <nav
        className="fixed left-0 right-0 z-50 px-4 pointer-events-none"
        style={containerStyles}
      >
        <div className="mx-auto max-w-[520px] pointer-events-auto">
          <div
            className="flex items-center justify-around gap-2 rounded-[28px] border border-[hsl(var(--header-border)/0.35)] bg-[hsl(var(--header-bg)/0.9)] shadow-[0_18px_45px_rgba(6,11,25,0.55)] backdrop-blur-2xl px-4"
            style={navSurfaceStyles}
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (item.primary) {
                return (
                  <div
                    key={item.href}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={() => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                      }
                    }}
                    suppressHydrationWarning
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-full neo-gradient text-white neo-glow flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl mb-1">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-semibold text-[hsl(var(--nav-text-primary))] whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  suppressHydrationWarning
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all min-w-[68px]",
                    "active:scale-95",
                    isActive
                      ? "neo-card neo-glow-sm text-[hsl(var(--nav-icon-active))] bg-[hsl(var(--header-bg))]"
                      : "text-[hsl(var(--nav-text-secondary)/0.75)] hover:text-[hsl(var(--nav-text-secondary))]"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        <TemplateDrawer
          open={showTemplateDrawer}
          onOpenChange={setShowTemplateDrawer}
          onSelect={handleTemplateSelect}
        />
      </nav>
    </>
  );
}
