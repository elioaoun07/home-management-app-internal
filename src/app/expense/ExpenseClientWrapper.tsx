"use client";

import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WatchView from "@/components/watch/WatchView";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";

export default function ExpenseClientWrapper() {
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
        <WatchView />
      </WatchErrorBoundary>
    );
  }

  return (
    <main className="h-screen overflow-hidden">
      <MobileExpenseForm />
    </main>
  );
}
