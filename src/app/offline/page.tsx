// src/app/offline/page.tsx
// Lightweight offline fallback page — shown by service worker when no cached page is available
"use client";

import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    // Try to read pending count from IndexedDB
    async function loadCount() {
      try {
        const { getQueueCount } = await import("@/lib/offlineQueue");
        const count = await getQueueCount();
        setPendingCount(count);
      } catch {
        setPendingCount(null);
      }
    }
    loadCount();

    // Listen for online event to auto-reload
    const handleOnline = () => {
      window.location.href = "/";
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 010 7.072M15.536 8.464a5 5 0 000 7.072M12 12h.01"
          />
          {/* Strike-through line */}
          <line
            x1="4"
            y1="4"
            x2="20"
            y2="20"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-gray-400 text-center text-sm mb-6 max-w-xs">
        No internet connection available. Please check your network and try
        again.
      </p>

      {/* Pending count */}
      {pendingCount !== null && pendingCount > 0 && (
        <div className="mb-6 px-4 py-2 rounded-xl bg-amber-950/50 border border-amber-500/20">
          <p className="text-amber-400 text-sm text-center">
            <span className="font-semibold">{pendingCount}</span> pending change
            {pendingCount !== 1 ? "s" : ""} will sync when you&apos;re back
            online
          </p>
        </div>
      )}

      {/* Retry button */}
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors active:scale-95"
      >
        Try Again
      </button>

      {/* Auto-reconnect hint */}
      <p className="text-gray-600 text-xs mt-8 text-center">
        This page will reload automatically when you reconnect.
      </p>
    </div>
  );
}
