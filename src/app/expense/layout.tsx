"use client";

import { ExpenseFormProvider } from "@/components/expense/ExpenseFormContext";
import ExpenseTagsBarWrapper from "@/components/expense/ExpenseTagsBarWrapper";
import ExpenseShell from "@/components/layouts/ExpenseShell";
import { useTab } from "@/contexts/TabContext";
import React from "react";

export default function ExpenseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeTab } = useTab();

  // Only show tags bar when actively on the expense tab (not dashboard or drafts)
  const showTagsBar = activeTab === "expense";

  return (
    <ExpenseFormProvider>
      <ExpenseShell>{children}</ExpenseShell>
      {showTagsBar && <ExpenseTagsBarWrapper />}
    </ExpenseFormProvider>
  );
}
