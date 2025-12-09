"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * App Mode Context
 * Manages the current mode of the app (budget vs reminder/items)
 * and tracks what the user wants to create
 */

// The two main modes of the application
export type AppMode = "budget" | "items";

// Sub-modes within items mode
export type ItemsSubMode = "reminders" | "events" | "tasks" | "all";

// What the user is creating (for the FAB)
export type CreateMode = "expense" | "reminder" | "event" | "task" | null;

interface AppModeContextType {
  // Current app mode (budget or items/reminders)
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Sub-mode within items (what type of items to show)
  itemsSubMode: ItemsSubMode;
  setItemsSubMode: (mode: ItemsSubMode) => void;

  // What the user is creating (controls the form shown)
  createMode: CreateMode;
  setCreateMode: (mode: CreateMode) => void;

  // Helper to open the create form for a specific type
  openCreateForm: (mode: CreateMode) => void;
  closeCreateForm: () => void;

  // Quick toggle helpers
  toggleAppMode: () => void;
  isBudgetMode: boolean;
  isItemsMode: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  // Initialize appMode based on FAB selection from localStorage
  const [appMode, setAppMode] = useState<AppMode>(() => {
    if (typeof window !== "undefined") {
      const fabSelection = localStorage.getItem("fab-last-selection");
      if (fabSelection === "reminder") {
        return "items";
      }
    }
    return "budget"; // Default to budget for expense mode or no selection
  });
  const [itemsSubMode, setItemsSubMode] = useState<ItemsSubMode>("all");
  const [createMode, setCreateMode] = useState<CreateMode>(null);

  const toggleAppMode = useCallback(() => {
    setAppMode((prev) => (prev === "budget" ? "items" : "budget"));
  }, []);

  const openCreateForm = useCallback((mode: CreateMode) => {
    setCreateMode(mode);
  }, []);

  const closeCreateForm = useCallback(() => {
    setCreateMode(null);
  }, []);

  // Listen for FAB selection changes and sync appMode
  useEffect(() => {
    const handleStorageChange = () => {
      const fabSelection = localStorage.getItem("fab-last-selection");
      if (fabSelection === "expense") {
        setAppMode("budget");
      } else if (fabSelection === "reminder") {
        setAppMode("items");
      }
    };

    // Listen for storage events from other tabs/windows
    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom event within same tab
    window.addEventListener("fab-selection-changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("fab-selection-changed", handleStorageChange);
    };
  }, []);

  const value: AppModeContextType = {
    appMode,
    setAppMode,
    itemsSubMode,
    setItemsSubMode,
    createMode,
    setCreateMode,
    openCreateForm,
    closeCreateForm,
    toggleAppMode,
    isBudgetMode: appMode === "budget",
    isItemsMode: appMode === "items",
  };

  return (
    <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error("useAppMode must be used within AppModeProvider");
  }
  return context;
}

// Safe version that returns null if outside provider
export function useAppModeSafe() {
  return useContext(AppModeContext);
}
