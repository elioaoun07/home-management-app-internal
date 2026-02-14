"use client";

import FocusPage from "@/components/focus/FocusPage";
import { useEffect, useState } from "react";

export default function FocusStandalonePage() {
  // Prevent hydration mismatch by only rendering FocusPage after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a loading skeleton that matches the server render
    return (
      <main className="h-screen bg-bg-dark overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="px-4 pt-4 space-y-4">
            {/* Header skeleton */}
            <div className="flex items-center justify-between animate-pulse">
              <div>
                <div className="h-6 w-32 bg-white/5 rounded mb-2" />
                <div className="h-4 w-24 bg-white/5 rounded" />
              </div>
              <div className="w-10 h-10 bg-white/5 rounded-lg" />
            </div>
            {/* Quick entry skeleton */}
            <div className="h-12 bg-white/5 rounded-xl" />
            {/* Toggle skeleton */}
            <div className="h-10 bg-white/5 rounded-lg" />
            {/* Items skeleton */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-xl bg-white/5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/10" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-24 bg-white/10 rounded" />
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
    <main className="h-screen bg-bg-dark overflow-hidden">
      <FocusPage standalone />
    </main>
  );
}
