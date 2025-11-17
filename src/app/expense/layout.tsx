"use client";

import { ExpenseFormProvider } from "@/components/expense/ExpenseFormContext";
import ExpenseTagsBarWrapper from "@/components/expense/ExpenseTagsBarWrapper";
import ExpenseShell from "@/components/layouts/ExpenseShell";
import React from "react";

export default function ExpenseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExpenseFormProvider>
      <ExpenseShell>{children}</ExpenseShell>
      <ExpenseTagsBarWrapper />
    </ExpenseFormProvider>
  );
}
