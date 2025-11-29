"use client";

import { ExpenseFormProvider } from "@/components/expense/ExpenseFormContext";
import ExpenseTagsBarWrapper from "@/components/expense/ExpenseTagsBarWrapper";
import ExpenseShell from "@/components/layouts/ExpenseShell";
import { useTab } from "@/contexts/TabContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import React from "react";

export default function ExpenseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeClasses = useThemeClasses();
  const { activeTab } = useTab();
  const { viewMode, isLoaded } = useViewMode();

  // Only show tags bar when actively on the expense tab (not dashboard or drafts)
  // and only in mobile view mode (not web or watch)
  const showTagsBar = activeTab === "expense" && viewMode === "mobile";

  // Wait for view mode to load before rendering
  if (!isLoaded) {
    return (
      <div
        className={`min-h-screen ${themeClasses.pageBg} flex items-center justify-center`}
      >
        <div className={themeClasses.loadingText}>Loading...</div>
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
