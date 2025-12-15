"use client";

import DashboardClientPage from "@/app/dashboard/DashboardClientPage";
import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import HubPage from "@/components/hub/HubPage";
import MobileReminderForm from "@/components/reminder/MobileReminderForm";
import SimpleWatchView from "@/components/watch/SimpleWatchView";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WebViewContainer from "@/components/web/WebViewContainer";
import { useTab } from "@/contexts/TabContext";
import { useViewMode } from "@/hooks/useViewMode";

export default function TabContainer() {
  const { viewMode, isLoaded } = useViewMode();
  const { activeTab } = useTab();

  // During initial hydration, always render mobile view to match server
  // This prevents hydration mismatch when user has web/watch mode saved
  // After hydration (isLoaded=true), render the correct view
  if (!isLoaded) {
    // Return mobile view structure during SSR/hydration
    return (
      <>
        <div className={activeTab === "dashboard" ? "block" : "hidden"}>
          <DashboardClientPage />
        </div>
        <div className={activeTab === "expense" ? "block" : "hidden"}>
          <main className="h-screen">
            <MobileExpenseForm />
          </main>
        </div>
        <div className={activeTab === "reminder" ? "block" : "hidden"}>
          <main className="h-screen">
            <MobileReminderForm />
          </main>
        </div>
        <div className={activeTab === "hub" ? "block pt-14" : "hidden"}>
          <HubPage />
        </div>
      </>
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
      <div className={activeTab === "dashboard" ? "block" : "hidden"}>
        <DashboardClientPage />
      </div>
      <div className={activeTab === "expense" ? "block" : "hidden"}>
        <main className="h-screen">
          <MobileExpenseForm />
        </main>
      </div>
      <div className={activeTab === "reminder" ? "block" : "hidden"}>
        <main className="h-screen">
          <MobileReminderForm />
        </main>
      </div>
      <div className={activeTab === "hub" ? "block pt-14" : "hidden"}>
        <HubPage />
      </div>
    </>
  );
}
