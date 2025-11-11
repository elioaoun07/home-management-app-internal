import ExpenseShell from "@/components/layouts/ExpenseShell";
import React from "react";

export default function ExpenseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ExpenseShell>{children}</ExpenseShell>;
}
