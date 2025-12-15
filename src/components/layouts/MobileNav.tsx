/**
 * Mobile Bottom Navigation
 * Thumb-zone friendly navigation for mobile devices
 * Now with SemiDonutFAB for creating expenses and reminders
 */
"use client";

import DraftsDrawer from "@/components/expense/DraftsDrawer";
import type { Template } from "@/components/expense/TemplateDrawer";
import TemplateDrawer from "@/components/expense/TemplateDrawer";
import {
  BarChart3Icon,
  HubIcon,
  MicIcon,
} from "@/components/icons/FuturisticIcons";
import SemiDonutFAB, {
  type FABSelection,
} from "@/components/navigation/SemiDonutFAB";
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
import { useDraftCount } from "@/features/drafts/useDrafts";
import {
  prefetchAllTabs,
  prefetchExpenseData,
} from "@/features/navigation/prefetchTabs";
import { useAddTransaction } from "@/features/transactions/useDashboardTransactions";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import { ToastIcons } from "@/lib/toastIcons";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

type TabId = "dashboard" | "expense" | "reminder" | "hub";

// Nav items without the primary FAB (now handled by SemiDonutFAB)
const navItems: Array<{
  id: TabId;
  icon: any;
  label: string;
}> = [
  { id: "dashboard", icon: BarChart3Icon, label: "Dashboard" },
  { id: "hub", icon: HubIcon, label: "Hub" },
];

export default function MobileNav() {
  const themeClasses = useThemeClasses();
  const { activeTab, setActiveTab } = useTab();
  const queryClient = useQueryClient();
  const addTransactionMutation = useAddTransaction();
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [templateAmount, setTemplateAmount] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const { viewMode } = useViewMode();
  const prefetchedRef = useRef({
    dashboard: false,
    expense: false,
    all: false,
  });

  // Draft transactions count for floating badge
  const draftCount = useDraftCount();

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

  // Handle FAB menu selection - navigate to the appropriate tab
  const handleFABSelect = (mode: FABSelection) => {
    if (mode === "expense") {
      // Navigate to expense tab for adding expense
      setActiveTab("expense");
    } else if (mode === "reminder") {
      // Navigate to reminder tab for adding reminder
      setActiveTab("reminder");
    }
  };

  // Handle FAB long press - open template drawer
  const handleFABLongPress = () => {
    setShowTemplateDrawer(true);
  };

  const handleTemplateSelect = (template: Template) => {
    setShowTemplateDrawer(false);
    setSelectedTemplate(template);
    setTemplateAmount(template.amount);
    setTemplateDescription(template.description || "");
  };

  const handleConfirmTemplate = () => {
    if (!selectedTemplate || !selectedTemplate.account_id) return;

    // Close dialog immediately for instant UI feedback
    const template = selectedTemplate;
    const amount = templateAmount;
    const desc = templateDescription;
    setSelectedTemplate(null);
    setTemplateAmount("");
    setTemplateDescription("");

    // Optimistic add - mutation hook handles cache updates
    addTransactionMutation.mutate(
      {
        account_id: template.account_id!,
        category_id: template.category_id,
        subcategory_id: template.subcategory_id,
        amount: parseFloat(amount),
        description: desc || undefined,
        date: new Date().toISOString().split("T")[0],
      },
      {
        onSuccess: () => {
          toast.success("Transaction added!", {
            icon: ToastIcons.create,
            description: `$${parseFloat(amount).toFixed(2)} from template`,
          });
        },
        onError: (error) => {
          console.error("Template transaction failed", error);
          toast.error("Failed to create transaction", {
            icon: ToastIcons.error,
          });
        },
      }
    );
  };

  const navSurfaceStyles: CSSProperties = {
    height: `${MOBILE_NAV_HEIGHT}px`,
  };

  // Hide nav in watch/web mode - after all hooks are called
  if (viewMode === "watch" || viewMode === "web") {
    return null;
  }

  return (
    <>
      {/* Floating Draft Transactions Badge */}
      {draftCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDraftsDrawer(true)}
          className="fixed bottom-24 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-amber-500/90 text-white shadow-lg hover:bg-amber-600 active:scale-95 transition-all animate-in slide-in-from-right-5 duration-300"
          style={{
            boxShadow: "0 4px 20px rgba(245, 158, 11, 0.4)",
          }}
        >
          <MicIcon className="w-4 h-4" />
          <span className="text-sm font-semibold">
            {draftCount} Draft{draftCount > 1 ? "s" : ""}
          </span>
        </button>
      )}

      {/* Drafts Drawer */}
      <DraftsDrawer
        open={showDraftsDrawer}
        onOpenChange={setShowDraftsDrawer}
      />

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md pb-safe shadow-2xl"
        style={{
          ...navSurfaceStyles,
          boxShadow: themeClasses.navShadow,
        }}
      >
        <div className="flex items-center justify-around gap-2 px-4 h-full">
          {/* Dashboard Tab */}
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              setActiveTab("dashboard");

              // Set dashboard mode based on FAB selection
              const fabSelection = localStorage.getItem("fab-last-selection");
              // This will be picked up by DashboardClientPage on mount
            }}
            onMouseEnter={handleDashboardPrefetch}
            onTouchStart={handleDashboardPrefetch}
            suppressHydrationWarning
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all min-w-[68px] hover:scale-105",
              "active:scale-95",
              activeTab === "dashboard"
                ? "neo-card neo-glow-sm text-[hsl(var(--nav-icon-active))] bg-[hsl(var(--header-bg))]"
                : "text-[hsl(var(--nav-text-secondary)/0.75)] hover:text-[hsl(var(--nav-text-secondary))]"
            )}
          >
            <div className="relative">
              <BarChart3Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium whitespace-nowrap">
              Dashboard
            </span>
          </button>

          {/* Center FAB - SemiDonutFAB */}
          <div className="flex flex-col items-center justify-center -mt-8">
            <SemiDonutFAB
              onSelect={handleFABSelect}
              onLongPress={handleFABLongPress}
            />
            <span className="text-[10px] font-semibold text-[hsl(var(--nav-text-primary))] whitespace-nowrap mt-1">
              Add
            </span>
          </div>

          {/* Hub Tab */}
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              setActiveTab("hub");
            }}
            suppressHydrationWarning
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all min-w-[68px] hover:scale-105",
              "active:scale-95",
              activeTab === "hub"
                ? "neo-card neo-glow-sm text-[hsl(var(--nav-icon-active))] bg-[hsl(var(--header-bg))]"
                : "text-[hsl(var(--nav-text-secondary)/0.75)] hover:text-[hsl(var(--nav-text-secondary))]"
            )}
          >
            <div className="relative">
              <HubIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium whitespace-nowrap">
              Hub
            </span>
          </button>
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
                  disabled={addTransactionMutation.isPending}
                />
              </div>
              <div>
                <Label className={themeClasses.headerText}>Description</Label>
                <Input
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optional notes"
                  className={`${themeClasses.inputBg} ${themeClasses.border} text-white`}
                  disabled={addTransactionMutation.isPending}
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
                  disabled={addTransactionMutation.isPending}
                  className={`${themeClasses.border} ${themeClasses.headerText}`}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addTransactionMutation.isPending || !templateAmount}
                  className="neo-gradient text-white"
                >
                  {addTransactionMutation.isPending
                    ? "Adding..."
                    : "Add Transaction"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </nav>
    </>
  );
}
