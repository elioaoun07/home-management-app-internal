/**
 * Mobile Bottom Navigation
 * Thumb-zone friendly navigation for mobile devices
 */
"use client";

import type { Template } from "@/components/expense/TemplateDrawer";
import TemplateDrawer from "@/components/expense/TemplateDrawer";
import {
  BarChart3Icon,
  CalendarClockIcon,
  PlusIcon,
} from "@/components/icons/FuturisticIcons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOBILE_NAV_HEIGHT } from "@/constants/layout";
import { useTab } from "@/contexts/TabContext";
import { prefetchDashboardData } from "@/features/dashboard/prefetchDashboard";
import {
  prefetchAllTabs,
  prefetchExpenseData,
} from "@/features/navigation/prefetchTabs";
import { useDuePaymentsCount } from "@/features/recurring/useRecurringPayments";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type TabId = "dashboard" | "expense" | "recurring";

const navItems: Array<{
  id: TabId;
  icon: any;
  label: string;
  primary?: boolean;
}> = [
  { id: "dashboard", icon: BarChart3Icon, label: "Dashboard" },
  { id: "expense", icon: PlusIcon, label: "Add", primary: true },
  { id: "recurring", icon: CalendarClockIcon, label: "Recurring" },
];

export default function MobileNav() {
  const themeClasses = useThemeClasses();
  const { activeTab, setActiveTab } = useTab();
  const queryClient = useQueryClient();
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [templateAmount, setTemplateAmount] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const duePaymentsCount = useDuePaymentsCount();
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
    setShowTemplateDrawer(false);
    setSelectedTemplate(template);
    setTemplateAmount(template.amount);
    setTemplateDescription(template.description || "");
  };

  const handleConfirmTemplate = async () => {
    if (!selectedTemplate) return;

    setIsCreatingTemplate(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: selectedTemplate.account_id,
          category_id: selectedTemplate.category_id,
          subcategory_id: selectedTemplate.subcategory_id,
          amount: templateAmount,
          description: templateDescription,
          date: new Date().toISOString().split("T")[0],
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create transaction");
      }

      // Invalidate queries to update dashboard
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: ["account-balance"],
        }),
      ]);

      toast.success("Transaction added!");
      setSelectedTemplate(null);
      setTemplateAmount("");
      setTemplateDescription("");
    } catch (error) {
      console.error("Template transaction failed", error);
      toast.error("Failed to create transaction");
    } finally {
      setIsCreatingTemplate(false);
    }
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
      {/* Floating Due Payments Notification - Above Nav Bar */}
      {duePaymentsCount > 0 && (
        <div
          className="fixed right-4 z-40 animate-in slide-in-from-bottom-4 duration-300"
          style={{
            bottom: `calc(${MOBILE_NAV_HEIGHT}px + env(safe-area-inset-bottom) + 12px)`,
          }}
        >
          <button
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              setActiveTab("recurring");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${themeClasses.badgeBg} text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all neo-glow`}
          >
            <CalendarClockIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{duePaymentsCount}</span>
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md pb-safe shadow-2xl"
        style={{
          ...navSurfaceStyles,
          boxShadow: themeClasses.navShadow,
        }}
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
                  {item.id === "recurring" && duePaymentsCount > 0 && (
                    <span
                      className={`absolute -top-1 -right-1 ${themeClasses.badgeBg} text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1`}
                    >
                      {duePaymentsCount}
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

        {/* Template Confirmation Dialog */}
        <Dialog
          open={!!selectedTemplate}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTemplate(null);
              setTemplateAmount("");
              setTemplateDescription("");
            }
          }}
        >
          <DialogContent className={cn("neo-card", themeClasses.border)}>
            <DialogHeader>
              <DialogTitle className={themeClasses.dialogTitle}>
                Confirm Transaction: {selectedTemplate?.name}
              </DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmTemplate();
              }}
            >
              <div>
                <Label className={themeClasses.headerText}>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={templateAmount}
                  onChange={(e) => setTemplateAmount(e.target.value)}
                  required
                  autoFocus
                  className={`${themeClasses.inputBg} ${themeClasses.border} text-white`}
                  disabled={isCreatingTemplate}
                />
              </div>
              <div>
                <Label className={themeClasses.headerText}>Description</Label>
                <Input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optional notes"
                  className={`${themeClasses.inputBg} ${themeClasses.border} text-white`}
                  disabled={isCreatingTemplate}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setTemplateAmount("");
                    setTemplateDescription("");
                  }}
                  disabled={isCreatingTemplate}
                  className={`${themeClasses.border} ${themeClasses.headerText}`}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingTemplate || !templateAmount}
                  className="neo-gradient text-white"
                >
                  {isCreatingTemplate ? "Adding..." : "Add Transaction"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </nav>
    </>
  );
}
