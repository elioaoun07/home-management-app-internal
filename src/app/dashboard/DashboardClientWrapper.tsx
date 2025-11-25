"use client";

import SimpleWatchView from "@/components/watch/SimpleWatchView";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import DashboardClientPage from "./DashboardClientPage";

export default function DashboardClientWrapper() {
  const themeClasses = useThemeClasses();
  const { viewMode, isLoaded } = useViewMode();

  if (!isLoaded) {
    return (
      <div
        className={`min-h-screen ${themeClasses.pageBg} flex items-center justify-center`}
      >
        <div className={themeClasses.loadingText}>Loading...</div>
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
