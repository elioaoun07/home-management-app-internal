"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Chores was merged into /reminders as a tab (see ERA Notes/02 - Standalone Modules/Chores).
// This route survives only to redirect old links / the installed PWA shortcut.
export default function ChoresRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reminders?tab=chores");
  }, [router]);

  return <div className="min-h-screen" />;
}
