"use client";

import HubPage from "@/components/hub/HubPage";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function ChatStandalonePage() {
  const searchParams = useSearchParams();
  const threadParam = useMemo(() => searchParams.get("thread"), [searchParams]);

  // Prevent hydration mismatch by only rendering HubPage after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Clean URL params after reading (they've been captured above)
  useEffect(() => {
    if (mounted && threadParam) {
      window.history.replaceState({}, "", "/chat");
    }
  }, [mounted, threadParam]);

  if (!mounted) {
    // Return a loading skeleton that matches the server render
    return (
      <main className="h-screen bg-background pt-14 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="divide-y divide-white/5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/5" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-white/5 rounded mb-2" />
                    <div className="h-3 w-48 bg-white/5 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-background pt-14 overflow-hidden">
      <HubPage standalone initialThreadId={threadParam || undefined} />
    </main>
  );
}
