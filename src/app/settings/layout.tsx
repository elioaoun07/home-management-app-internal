"use client";

import ExpenseShell from "@/components/layouts/ExpenseShell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ExpenseShell>{children}</ExpenseShell>;
}
