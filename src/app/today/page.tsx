"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

// Plan My Day was merged into /reminders (see ERA Notes/03 - Junction Modules/Plan My Day).
// This route survives only to redirect old links / the installed PWA shortcut.
export default function TodayRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = useMemo(() => searchParams.get("date"), [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateParam) params.set("date", dateParam);
    params.set("plan", "1");
    router.replace(`/reminders?${params.toString()}`);
  }, [router, dateParam]);

  return <div className="min-h-screen" />;
}
