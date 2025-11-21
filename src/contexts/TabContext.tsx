"use client";

import { createContext, ReactNode, useContext, useState } from "react";

type Tab = "dashboard" | "expense" | "drafts";

interface TabContextType {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("expense");

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
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
