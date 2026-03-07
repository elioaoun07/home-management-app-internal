"use client";

import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { useTab } from "@/contexts/TabContext";
import { useViewMode } from "@/hooks/useViewMode";
import dynamic from "next/dynamic";

// Lazy load non-default tabs for faster initial load
// MobileExpenseForm is the default start page, so it's loaded eagerly
const ActivityView = dynamic(
  () => import("@/components/activity/ActivityView"),
  { ssr: false },
);
const MobileReminderForm = dynamic(
  () => import("@/components/reminder/MobileReminderForm"),
  { ssr: false },
);
const RecurringPage = dynamic(() => import("@/app/recurring/page"), {
  ssr: false,
});

// Lazy load view modes that aren't the default mobile view
const SimpleWatchView = dynamic(
  () => import("@/components/watch/SimpleWatchView"),
  { ssr: false },
);
const WatchErrorBoundary = dynamic(
  () =>
    import("@/components/watch/WatchErrorBoundary").then(
      (mod) => mod.WatchErrorBoundary,
    ),
  { ssr: false },
);
const WebViewContainer = dynamic(
  () => import("@/components/web/WebViewContainer"),
  { ssr: false },
);

export default function TabContainer() {
  const { viewMode } = useViewMode();
  const { activeTab, isHydrated } = useTab();

  // INSTANT RENDER - No loading screens
  // Always render immediately using cached data
  // APIs run in background, only balance shows loading indicator

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
  // Use visibility to prevent hydration mismatch while avoiding flash
  // Server and client both render with visibility:hidden initially
  // After useLayoutEffect runs, isHydrated becomes true and correct tab is shown
  return (
    <div style={{ visibility: isHydrated ? "visible" : "hidden" }}>
      <div className={activeTab === "dashboard" ? "block" : "hidden"}>
        <ActivityView />
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
      <div className={activeTab === "recurring" ? "block pt-14" : "hidden"}>
        <RecurringPage />
      </div>
    </div>
  );
}
