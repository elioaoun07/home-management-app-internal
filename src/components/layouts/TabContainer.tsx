"use client";

import DashboardClientPage from "@/app/dashboard/DashboardClientPage";
import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WatchView from "@/components/watch/WatchView";
import { useTab } from "@/contexts/TabContext";
import { useViewMode } from "@/hooks/useViewMode";
import { Suspense, lazy } from "react";

// Lazy load pages to reduce bundle size
const DraftsPage = lazy(() => import("@/app/expense/drafts/page"));

export default function TabContainer() {
  const { activeTab } = useTab();
  const { viewMode, isLoaded } = useViewMode();

  // Show loading while view mode is being loaded from localStorage
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-[#38bdf8]">Loading...</div>
      </div>
    );
  }

  // Watch view replaces the entire interface
  if (viewMode === "watch") {
    return (
      <WatchErrorBoundary>
        <WatchView />
      </WatchErrorBoundary>
    );
  }

  // Web view - to be implemented later
  if (viewMode === "web") {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-8">
        <div className="neo-card p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-[#38bdf8] mb-4">
            Web View Coming Soon
          </h2>
          <p className="text-[hsl(var(--text-muted))]">
            The desktop web interface is currently under development. Please
            switch back to Mobile or Watch view in Settings.
          </p>
        </div>
      </div>
    );
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
        <main className="h-screen overflow-hidden">
          <MobileExpenseForm />
        </main>
      </div>

      {/* Drafts: Add top padding for fixed header */}
      <div className={activeTab === "drafts" ? "block pt-14" : "hidden"}>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
              <div className="text-[#38bdf8]">Loading...</div>
            </div>
          }
        >
          <DraftsPage />
        </Suspense>
      </div>
    </>
  );
}
