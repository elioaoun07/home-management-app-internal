"use client";

import StandaloneRemindersPage from "@/components/reminder/StandaloneRemindersPage";
import { useEffect, useState } from "react";

export default function RemindersStandalonePage() {
  // Prevent hydration mismatch by only rendering after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a loading skeleton that matches the server render
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-14">
        <div className="min-h-full p-4 pb-8 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 animate-pulse">
                <div className="h-8 bg-white/5 rounded mb-1" />
                <div className="h-3 bg-white/5 rounded w-12 mx-auto" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-white/5 animate-pulse h-14"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-14">
      <StandaloneRemindersPage />
    </main>
  );
}
