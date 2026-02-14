"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useLayoutEffect,
  useState,
} from "react";

type Tab = "dashboard" | "expense" | "reminder" | "hub";
type HubView = "chat" | "feed" | "score" | "alerts";

// Key for FAB selection (source of truth for which form to show)
const FAB_SELECTION_KEY = "fab-last-selection";

interface TabContextType {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  hubDefaultView: HubView | null;
  setHubDefaultView: (view: HubView | null) => void;
  isHydrated: boolean;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  // Always start with "expense" to match server render and avoid hydration mismatch
  const [activeTab, setActiveTab] = useState<Tab>("expense");
  const [hubDefaultView, setHubDefaultView] = useState<HubView | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // After hydration, check localStorage and update tab if needed
  // useLayoutEffect runs after hydration but BEFORE browser paint
  useLayoutEffect(() => {
    const fabSelection = localStorage.getItem(FAB_SELECTION_KEY);
    if (fabSelection === "reminder") {
      setActiveTab("reminder");
    }
    setIsHydrated(true);
  }, []);

  return (
    <TabContext.Provider
      value={{
        activeTab,
        setActiveTab,
        hubDefaultView,
        setHubDefaultView,
        isHydrated,
      }}
    >
      {children}
    </TabContext.Provider>
  );
}

export function useTab() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTab must be used within TabProvider");
  }
  return context;
}

// Safe version that returns null if outside provider
export function useTabSafe() {
  return useContext(TabContext);
}
