"use client";

import ChoresView from "@/components/chores/ChoresView";
import WebViewContainer from "@/components/web/WebViewContainer";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

function ChoresRoute() {
  const searchParams = useSearchParams();
  const { viewMode } = useViewMode();
  const tc = useThemeClasses();
  const date = searchParams.get("date");
  const initialDate = date && DATE_PARAM.test(date) ? date : undefined;

  // Desktop preference: same view inside the web shell (it owns the header).
  if (viewMode === "web") {
    return <WebViewContainer initialMode="chores" initialChoreDate={initialDate} />;
  }

  // Mobile: the standalone ConditionalHeader is fixed h-16.
  return (
    <main className={cn("min-h-screen pt-16", tc.bgPage)}>
      <ChoresView initialDate={initialDate} />
    </main>
  );
}

export default function ChoresPage() {
  return (
    <Suspense fallback={<main className="min-h-screen pt-16" />}>
      <ChoresRoute />
    </Suspense>
  );
}
