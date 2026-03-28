"use client";

import MobileExpenseForm from "@/components/expense/MobileExpenseForm";
import { WatchErrorBoundary } from "@/components/watch/WatchErrorBoundary";
import WatchView from "@/components/watch/WatchView";
import { useFuturePaymentAlerts } from "@/hooks/useFuturePaymentAlerts";
import { useViewMode } from "@/hooks/useViewMode";

export default function ExpenseClientWrapper() {
  const { viewMode } = useViewMode();

  // Show toast if any future payments are due
  useFuturePaymentAlerts();

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
    <main className="h-[100dvh] overflow-hidden">
      <MobileExpenseForm />
    </main>
  );
}
