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
  const { viewMode } = useViewMode();

  // Only show tags bar when actively on the expense tab (not dashboard or drafts)
  // and only in mobile view mode (not web or watch)
  const showTagsBar = activeTab === "expense" && viewMode === "mobile";

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
      {showTagsBar && <ExpenseTagsBarWrapper />}
    </ExpenseFormProvider>
  );
}
