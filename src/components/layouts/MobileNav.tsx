/**
 * Mobile Bottom Navigation
 * Thumb-zone friendly navigation for mobile devices
 */
"use client";

import type { Template } from "@/components/expense/TemplateDrawer";
import TemplateDrawer from "@/components/expense/TemplateDrawer";
import {
  BarChart3Icon,
  FileTextIcon,
  PlusIcon,
} from "@/components/icons/FuturisticIcons";
import { MOBILE_NAV_HEIGHT } from "@/constants/layout";
import { useTab } from "@/contexts/TabContext";
import { prefetchDashboardData } from "@/features/dashboard/prefetchDashboard";
import { useDraftCount } from "@/features/drafts/useDrafts";
import {
  prefetchAllTabs,
  prefetchExpenseData,
} from "@/features/navigation/prefetchTabs";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { type CSSProperties, useEffect, useRef, useState } from "react";

type TabId = "dashboard" | "expense" | "drafts";

const navItems: Array<{
  id: TabId;
  icon: any;
  label: string;
  primary?: boolean;
}> = [
  { id: "dashboard", icon: BarChart3Icon, label: "Dashboard" },
  { id: "expense", icon: PlusIcon, label: "Add", primary: true },
  { id: "drafts", icon: FileTextIcon, label: "Drafts" },
];

export default function MobileNav() {
  const { activeTab, setActiveTab } = useTab();
  const queryClient = useQueryClient();
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const draftCount = useDraftCount(); // Use hook instead of local state
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const { viewMode, isLoaded } = useViewMode();
  const prefetchedRef = useRef({
    dashboard: false,
    expense: false,
    all: false,
  });

  // Prefetch all tabs on initial mount for instant switching
  useEffect(() => {
    if (!prefetchedRef.current.all) {
      prefetchedRef.current.all = true;
      // Prefetch in the background after mount
      setTimeout(() => {
        prefetchAllTabs(queryClient);
      }, 1000);
    }
  }, [queryClient]);

  // Prefetch dashboard data on hover/touch for instant navigation
  const handleDashboardPrefetch = () => {
    if (!prefetchedRef.current.dashboard) {
      prefetchedRef.current.dashboard = true;
      prefetchDashboardData(queryClient);
    }
  };

  // Prefetch expense data on hover/touch for instant navigation
  const handleExpensePrefetch = () => {
    if (!prefetchedRef.current.expense) {
      prefetchedRef.current.expense = true;
      prefetchExpenseData(queryClient);
    }
  };

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
      // Normal tap - switch to expense tab
      setActiveTab("expense");
    }
    e.preventDefault();
  };

  const handleTemplateSelect = (template: Template) => {
    // Switch to expense tab with template data
    // TODO: Pass template to expense form context
    setActiveTab("expense");
  };

  const navSurfaceStyles: CSSProperties = {
    height: `${MOBILE_NAV_HEIGHT}px`,
  };

  // Hide nav in watch/web mode - after all hooks are called
  if (!isLoaded || viewMode === "watch" || viewMode === "web") {
    return null;
  }

  return (
    <>
      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md border-t border-[hsl(var(--header-border)/0.3)] pb-safe shadow-2xl"
        style={navSurfaceStyles}
      >
        <div className="flex items-center justify-around gap-2 px-4 h-full">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            if (item.primary) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={handleExpensePrefetch}
                  onTouchStart={(e) => {
                    handleExpensePrefetch();
                    handleTouchStart();
                  }}
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
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  // Haptic feedback for professional feel
                  if (navigator.vibrate) {
                    navigator.vibrate(10);
                  }
                  setActiveTab(item.id);
                }}
                onMouseEnter={
                  item.id === "dashboard" ? handleDashboardPrefetch : undefined
                }
                onTouchStart={
                  item.id === "dashboard" ? handleDashboardPrefetch : undefined
                }
                suppressHydrationWarning
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all min-w-[68px] hover:scale-105",
                  "active:scale-95",
                  isActive
                    ? "neo-card neo-glow-sm text-[hsl(var(--nav-icon-active))] bg-[hsl(var(--header-bg))]"
                    : "text-[hsl(var(--nav-text-secondary)/0.75)] hover:text-[hsl(var(--nav-text-secondary))]"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.id === "drafts" && draftCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#06b6d4] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {draftCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
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
