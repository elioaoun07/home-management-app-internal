/**
 * Mobile Bottom Navigation
 * Thumb-zone friendly navigation for mobile devices
 */
"use client";

import type { Template } from "@/components/expense/TemplateDrawer";
import TemplateDrawer from "@/components/expense/TemplateDrawer";
import { cn } from "@/lib/utils";
import { BarChart3, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md border-t border-[hsl(var(--header-border)/0.2)] pb-safe shadow-2xl">
      <div className="flex items-center justify-around px-2 py-2">
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
                className={cn(
                  "flex flex-col items-center justify-center relative -mt-6 cursor-pointer",
                  "active:scale-95 transition-all"
                )}
              >
                <div className="w-14 h-14 rounded-full neo-gradient text-white neo-glow flex items-center justify-center hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold mt-1 text-[hsl(var(--nav-text-primary))]">
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
                "flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-xl transition-all",
                "active:scale-95",
                isActive
                  ? "neo-card neo-glow-sm text-[hsl(var(--nav-icon-active))]"
                  : "text-[hsl(var(--nav-text-secondary)/0.7)] hover:text-[hsl(var(--nav-text-secondary))]"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <TemplateDrawer
        open={showTemplateDrawer}
        onOpenChange={setShowTemplateDrawer}
        onSelect={handleTemplateSelect}
      />
    </nav>
  );
}
