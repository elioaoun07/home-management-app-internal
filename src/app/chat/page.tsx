"use client";

import HubPage from "@/components/hub/HubPage";
import { useEffect, useState } from "react";

export default function ChatStandalonePage() {
  // Prevent hydration mismatch by only rendering HubPage after mount
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a loading skeleton that matches the server render
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-14">
        <div className="min-h-screen pb-4 px-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl neo-card bg-bg-card-custom border border-white/5 animate-pulse"
              >
                <div className="h-16 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/95 pt-14">
      <HubPage standalone />
    </main>
  );
}
