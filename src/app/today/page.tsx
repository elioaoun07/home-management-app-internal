"use client";

import WebDayPlanner from "@/components/planner/WebDayPlanner";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function TodayPage() {
  const searchParams = useSearchParams();
  const dateParam = useMemo(() => searchParams.get("date") ?? undefined, [searchParams]);

  // Prevent hydration mismatch by only rendering WebDayPlanner after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clean the URL param after reading it (it's been captured above)
  useEffect(() => {
    if (mounted && dateParam) {
      window.history.replaceState({}, "", "/today");
    }
  }, [mounted, dateParam]);

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return <WebDayPlanner initialDate={dateParam} />;
}
