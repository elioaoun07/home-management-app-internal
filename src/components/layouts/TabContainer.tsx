"use client";

import DashboardClientPage from "@/app/dashboard/DashboardClientPage";
import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import HubPage from "@/components/hub/HubPage";
import MobileReminderForm from "@/components/reminder/MobileReminderForm";
import SimpleWatchView from "@/components/watch/SimpleWatchView";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WebViewContainer from "@/components/web/WebViewContainer";
import { useTab } from "@/contexts/TabContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

export default function TabContainer() {
  const { viewMode, isLoaded } = useViewMode();
  const { activeTab } = useTab(); // Always call hooks at the top level
  const themeClasses = useThemeClasses();

  // Show loading while view mode is being loaded from localStorage
  if (!isLoaded) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center",
          themeClasses.bgPage
        )}
      >
        <div className={cn("animate-pulse", themeClasses.text)}>Loading...</div>
      </div>
    );
  }

  // Watch view replaces the entire interface
  if (viewMode === "watch") {
    return (
      <WatchErrorBoundary>
        <SimpleWatchView />
      </WatchErrorBoundary>
    );
  }

  // Web view - Full responsive dashboard and budget interface
  if (viewMode === "web") {
    return <WebViewContainer />;
  }

  // Default mobile view
  return (
    <>
      {/* Render all tabs but only show active one - instant switching */}
      {/* Dashboard: No padding needed, sticky header handles positioning */}
      <div className={activeTab === "dashboard" ? "block" : "hidden"}>
        <DashboardClientPage />
      </div>

      {/* Expense: Positioning handled internally in MobileExpenseForm */}
      <div className={activeTab === "expense" ? "block" : "hidden"}>
        <main className="h-screen">
          <MobileExpenseForm />
        </main>
      </div>

      {/* Reminder: Similar to Expense, full page form */}
      <div className={activeTab === "reminder" ? "block" : "hidden"}>
        <main className="h-screen">
          <MobileReminderForm />
        </main>
      </div>

      {/* Hub: Add top padding for fixed header */}
      <div className={activeTab === "hub" ? "block pt-14" : "hidden"}>
        <HubPage />
      </div>
    </>
  );
}
