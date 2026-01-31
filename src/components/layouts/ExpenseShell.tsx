"use client";

import TabContainer from "@/components/layouts/TabContainer";
import React from "react";

export default function ExpenseShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TabContainer />;
}
