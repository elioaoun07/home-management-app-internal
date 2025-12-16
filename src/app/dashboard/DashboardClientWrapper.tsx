"use client";

import SimpleWatchView from "@/components/watch/SimpleWatchView";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WebViewContainer from "@/components/web/WebViewContainer";
import { useViewMode } from "@/hooks/useViewMode";
import DashboardClientPage from "./DashboardClientPage";

export default function DashboardClientWrapper() {
  const { viewMode } = useViewMode();

  // INSTANT RENDER - No loading screen
  // Dashboard shows immediately with cached data

  if (viewMode === "watch") {
    return (
      <WatchErrorBoundary>
        <SimpleWatchView />
      </WatchErrorBoundary>
    );
  }

  // Web view - Full responsive dashboard with header and user menu
  if (viewMode === "web") {
    return <WebViewContainer />;
  }

  return <DashboardClientPage />;
}
