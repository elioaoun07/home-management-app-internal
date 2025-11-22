"use client";

import SimpleWatchView from "@/components/watch/SimpleWatchView";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import { useViewMode } from "@/hooks/useViewMode";
import DashboardClientPage from "./DashboardClientPage";

export default function DashboardClientWrapper() {
  const { viewMode, isLoaded } = useViewMode();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-[#38bdf8]">Loading...</div>
      </div>
    );
  }

  if (viewMode === "watch") {
    return (
      <WatchErrorBoundary>
        <SimpleWatchView />
      </WatchErrorBoundary>
    );
  }

  return <DashboardClientPage />;
}
