"use client";

import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WatchView from "@/components/watch/WatchView";
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
