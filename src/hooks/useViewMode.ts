"use client";

import { useEffect, useState } from "react";

export type ViewMode = "mobile" | "web" | "watch";

const VIEW_MODE_KEY = "app-view-mode";

export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>("mobile");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    if (
      stored &&
      (stored === "mobile" || stored === "web" || stored === "watch")
    ) {
      setViewMode(stored as ViewMode);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when changed
  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  return { viewMode, updateViewMode, isLoaded };
}
