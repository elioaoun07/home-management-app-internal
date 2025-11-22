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
  const showTagsBar = activeTab === "expense";

  // In watch mode, skip the shell wrapper entirely
  if (viewMode === "watch") {
    return <>{children}</>;
  }

  return (
    <ExpenseFormProvider>
      <ExpenseShell>{children}</ExpenseShell>
      {showTagsBar && <ExpenseTagsBarWrapper />}
    </ExpenseFormProvider>
  );
}
