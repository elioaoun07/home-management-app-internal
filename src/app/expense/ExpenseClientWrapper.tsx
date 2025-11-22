"use client";

import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import SimpleWatchView from "@/components/watch/SimpleWatchView";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import { useViewMode } from "@/hooks/useViewMode";

export default function ExpenseClientWrapper() {
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

  return (
    <main className="h-screen overflow-hidden">
      <MobileExpenseForm />
    </main>
  );
}
