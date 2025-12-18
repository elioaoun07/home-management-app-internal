"use client";

import { createContext, ReactNode, useContext, useState } from "react";

type Tab = "dashboard" | "expense" | "reminder" | "hub";
type HubView = "chat" | "feed" | "score" | "alerts";

interface TabContextType {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  hubDefaultView: HubView | null;
  setHubDefaultView: (view: HubView | null) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("expense");
  const [hubDefaultView, setHubDefaultView] = useState<HubView | null>(null);

  return (
    <TabContext.Provider
      value={{ activeTab, setActiveTab, hubDefaultView, setHubDefaultView }}
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
