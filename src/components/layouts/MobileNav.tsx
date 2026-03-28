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
  CalendarClockIcon,
  ListIcon,
  MicIcon,
} from "@/components/icons/FuturisticIcons";
import SemiDonutFAB, {
  type FABSelection,
} from "@/components/navigation/SemiDonutFAB";
import QRScannerDrawer from "@/components/scanner/QRScannerDrawer";
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
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";

type TabId = "dashboard" | "expense" | "reminder" | "recurring";

// Nav items without the primary FAB (now handled by SemiDonutFAB)
// Left side: Dashboard | Right side: Recurring
const navItems: Array<{
  id: TabId;
  icon: any;
  label: string;
  position: "left" | "right";
}> = [
  {
    id: "dashboard",
    icon: ListIcon,
    label: "Activity",
    position: "left",
  },
  {
    id: "recurring",
    icon: CalendarClockIcon,
    label: "Recurring",
    position: "right",
  },
];

export default function MobileNav() {
  const themeClasses = useThemeClasses();
  const { activeTab, setActiveTab } = useTab();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addTransactionMutation = useAddTransaction();
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [templateAmount, setTemplateAmount] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const { viewMode } = useViewMode();
  const pathname = usePathname();
  const prefetchedRef = useRef({
    dashboard: false,
    expense: false,
    all: false,
  });

  // Defer route/viewMode-dependent rendering until after hydration to prevent
  // SSR/client mismatch when PWA service worker serves cached HTML from a different route.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Draft transactions count for floating badge
  const draftCount = useDraftCount();

  // Track online/offline status via connectivity manager events
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    let cm: typeof import("@/lib/connectivityManager") | null = null;
    import("@/lib/connectivityManager").then((mod) => {
      cm = mod;
      setIsOnline(mod.isReallyOnline());
    });
    const handler = (e: Event) => {
      setIsOnline((e as CustomEvent).detail?.online ?? true);
    };
    // Also listen to legacy events as fallback
    const onOffline = () => setIsOnline(false);
    window.addEventListener("connectivity-changed", handler);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("connectivity-changed", handler);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Standalone routes list (checked after hooks)
  const standaloneRoutes = [
    "/g/",
    "/temp",
    "/catalogue",
    "/recipe",
    "/chat",
    "/reminders",
    "/dashboard",
    "/focus",
    "/alerts",
  ];

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

  // Prefetch expense data on hover/touch for instant navigation
  const handleExpensePrefetch = () => {
    if (!prefetchedRef.current.expense) {
      prefetchedRef.current.expense = true;
      prefetchExpenseData(queryClient);
    }
  };

  // Handle FAB menu selection - navigate to the appropriate route
  const handleFABSelect = (mode: FABSelection) => {
    if (mode === "expense") {
      setActiveTab("expense");
      router.push("/expense");
    } else if (mode === "reminder") {
      setActiveTab("reminder");
      router.push("/expense");
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
      },
    );
  };

  const navSurfaceStyles: CSSProperties = {
    height: `${MOBILE_NAV_HEIGHT}px`,
  };

  // Evaluate hide conditions only after mount to avoid hydration mismatch.
  // Before mount, always render the full nav tree (matches any server/cached HTML).
  // After mount, React handles show/hide as a normal update (not hydration).
  const shouldHide =
    mounted &&
    (viewMode === "watch" ||
      viewMode === "web" ||
      standaloneRoutes.some((route) => pathname?.startsWith(route)));

  if (shouldHide) {
    return null;
  }

  // Offline: show only the centered FAB (only evaluated after mount)
  if (mounted && !isOnline) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center pb-safe"
        style={{ height: `${MOBILE_NAV_HEIGHT}px` }}
      >
        <div className="flex flex-col items-center justify-center -mt-4">
          <SemiDonutFAB onSelect={handleFABSelect} />
          <span className="text-[10px] font-semibold text-white/40 whitespace-nowrap mt-1">
            Add
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* QR Scanner Drawer */}
      <QRScannerDrawer open={showQRScanner} onOpenChange={setShowQRScanner} />

      {/* Floating Draft Transactions Badge */}
      {mounted && draftCount > 0 && (
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
        suppressHydrationWarning
      >
        <div className="flex items-center justify-around gap-1 px-2 h-full">
          {/* Activity Tab */}
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              setActiveTab("dashboard");
              if (pathname !== "/expense") router.push("/expense");
            }}
            onMouseEnter={handleExpensePrefetch}
            onTouchStart={handleExpensePrefetch}
            suppressHydrationWarning
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-2xl transition-all min-w-[52px] hover:scale-105",
              "active:scale-95",
              activeTab === "dashboard" && pathname === "/expense"
                ? "neo-card neo-glow-sm text-[hsl(var(--nav-icon-active))] bg-[hsl(var(--header-bg))]"
                : "text-[hsl(var(--nav-text-secondary)/0.75)] hover:text-[hsl(var(--nav-text-secondary))]",
            )}
          >
            <div className="relative">
              <ListIcon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-medium whitespace-nowrap">
              Activity
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

          {/* Recurring Tab */}
          <button
            type="button"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(10);
              setActiveTab("recurring");
              if (pathname !== "/expense") router.push("/expense");
            }}
            suppressHydrationWarning
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-2xl transition-all min-w-[52px] hover:scale-105",
              "active:scale-95",
              activeTab === "recurring" && pathname === "/expense"
                ? "neo-card neo-glow-sm text-[hsl(var(--nav-icon-active))] bg-[hsl(var(--header-bg))]"
                : "text-[hsl(var(--nav-text-secondary)/0.75)] hover:text-[hsl(var(--nav-text-secondary))]",
            )}
          >
            <div className="relative">
              <CalendarClockIcon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-medium whitespace-nowrap">
              Recurring
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
