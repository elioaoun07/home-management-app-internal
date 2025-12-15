"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type ViewMode = "mobile" | "web" | "watch";

const VIEW_MODE_KEY = "app-view-mode";

// Get stored value (client only)
function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "mobile";
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (stored === "mobile" || stored === "web" || stored === "watch") {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return "mobile";
}

// Subscribe to storage events for cross-tab sync
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// Server snapshot always returns "mobile" to match initial client render
function getServerSnapshot(): ViewMode {
  return "mobile";
}

export function useViewMode() {
  // useSyncExternalStore handles SSR correctly - uses getServerSnapshot during SSR
  // and getStoredViewMode on client after hydration
  const viewMode = useSyncExternalStore(
    subscribe,
    getStoredViewMode,
    getServerSnapshot
  );

  // Track if we've mounted (for components that need to know)
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Save to localStorage when changed
  const updateViewMode = (mode: ViewMode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    // Trigger re-render by dispatching storage event
    window.dispatchEvent(new StorageEvent("storage", { key: VIEW_MODE_KEY }));
  };

  return { viewMode, updateViewMode, isLoaded };
}
