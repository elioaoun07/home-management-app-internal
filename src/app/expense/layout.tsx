"use client";

import { ExpenseFormProvider } from "@/components/expense/ExpenseFormContext";
import ExpenseTagsBarWrapper from "@/components/expense/ExpenseTagsBarWrapper";
import ExpenseShell from "@/components/layouts/ExpenseShell";
import { useTab } from "@/contexts/TabContext";
import { useViewMode } from "@/hooks/useViewMode";
import React from "react";

export default function ExpenseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeTab } = useTab();
  const { viewMode, isLoaded } = useViewMode();

  // Only show tags bar when actively on the expense tab (not dashboard or drafts)
  const showTagsBar = activeTab === "expense";

  // Wait for view mode to load before rendering
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-[#38bdf8]">Loading...</div>
      </div>
    );
  }

  // In watch mode, skip the shell wrapper entirely but still provide context
  // (in case user is transitioning between modes)
  if (viewMode === "watch") {
    return <ExpenseFormProvider>{children}</ExpenseFormProvider>;
  }

  return (
    <ExpenseFormProvider>
      <ExpenseShell>{children}</ExpenseShell>
      {showTagsBar && <ExpenseTagsBarWrapper />}
    </ExpenseFormProvider>
  );
}
