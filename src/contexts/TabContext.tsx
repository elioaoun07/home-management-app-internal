"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useLayoutEffect,
  useState,
} from "react";

type Tab = "dashboard" | "expense" | "reminder" | "recurring" | "schedule";
type HubView = "chat" | "feed" | "score" | "alerts";

// Key for FAB selection (source of truth for which form to show)
const FAB_SELECTION_KEY = "fab-last-selection";

interface TabContextType {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  hubDefaultView: HubView | null;
  setHubDefaultView: (view: HubView | null) => void;
  isHydrated: boolean;
  // Deep link state - consumed once by target components then cleared
  pendingItemId: string | null;
  setPendingItemId: (id: string | null) => void;
  pendingAction: string | null;
  setPendingAction: (action: string | null) => void;
  pendingThreadId: string | null;
  setPendingThreadId: (id: string | null) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  // Always start with "expense" to match server render and avoid hydration mismatch
  const [activeTab, setActiveTab] = useState<Tab>("expense");
  // Legacy support: convert "hub" to "recurring" for any old deep links
  const setActiveTabSafe = (tab: Tab | "hub") => {
    setActiveTab(tab === ("hub" as any) ? "recurring" : (tab as Tab));
  };
  const [hubDefaultView, setHubDefaultView] = useState<HubView | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  // Deep link state for notification routing
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);

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
        setActiveTab: setActiveTabSafe as (tab: Tab) => void,
        hubDefaultView,
        setHubDefaultView,
        isHydrated,
        pendingItemId,
        setPendingItemId,
        pendingAction,
        setPendingAction,
        pendingThreadId,
        setPendingThreadId,
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
