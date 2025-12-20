"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type ViewMode = "mobile" | "web" | "watch";

const VIEW_MODE_KEY = "app-view-mode";

// Listeners for manual updates
let listeners: Array<() => void> = [];

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

// Subscribe to storage events for cross-tab sync AND manual updates
function subscribe(callback: () => void) {
  // Add to listeners array for manual updates
  listeners.push(callback);

  // Listen to storage events from other tabs
  const storageHandler = (e: StorageEvent) => {
    if (e.key === VIEW_MODE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", storageHandler);

  return () => {
    listeners = listeners.filter((l) => l !== callback);
    window.removeEventListener("storage", storageHandler);
  };
}

// Notify all listeners
function notifyListeners() {
  listeners.forEach((listener) => listener());
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
    // Manually notify all subscribers (for same-window updates)
    notifyListeners();
  };

  return { viewMode, updateViewMode, isLoaded };
}
