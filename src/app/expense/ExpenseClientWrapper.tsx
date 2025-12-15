"use client";

import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WatchView from "@/components/watch/WatchView";
import { useViewMode } from "@/hooks/useViewMode";

export default function ExpenseClientWrapper() {
  const { viewMode } = useViewMode();

  // No loading state - render immediately
  // Data loading happens inside the components with skeleton UI

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
