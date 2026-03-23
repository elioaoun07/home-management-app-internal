"use client";

import { ExpenseFormProvider } from "@/components/expense/ExpenseFormContext";
import ExpenseShell from "@/components/layouts/ExpenseShell";
import { useTab } from "@/contexts/TabContext";
import { useViewMode } from "@/hooks/useViewMode";
import React, { useEffect } from "react";

// Key for setting initial tab from external navigation (e.g., /focus)
const INITIAL_TAB_KEY = "initial-active-tab";

export default function ExpenseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setActiveTab } = useTab();
  const { viewMode } = useViewMode();

  // Check for explicit tab override (e.g., from /focus navigation)
  // Note: FAB selection is handled in TabProvider's initial state
  useEffect(() => {
    const initialTab = localStorage.getItem(INITIAL_TAB_KEY);
    if (
      initialTab &&
      ["dashboard", "expense", "reminder", "recurring"].includes(initialTab)
    ) {
      localStorage.removeItem(INITIAL_TAB_KEY);
      setActiveTab(
        initialTab as "dashboard" | "expense" | "reminder" | "recurring",
      );
    }
  }, [setActiveTab]);

  // No loading state - render immediately
  // viewMode is loaded synchronously from localStorage

  // In watch mode, skip the shell wrapper entirely but still provide context
  // (in case user is transitioning between modes)
  if (viewMode === "watch") {
    return <ExpenseFormProvider>{children}</ExpenseFormProvider>;
  }

  return (
    <ExpenseFormProvider>
      <ExpenseShell>{children}</ExpenseShell>
    </ExpenseFormProvider>
  );
}
