"use client";

import { createContext, ReactNode, useContext, useState } from "react";

type SplitBillData = {
  transaction_id: string;
  owner_amount: number;
  owner_description: string;
  category_name: string;
  date?: string;
};

type SplitBillContextType = {
  currentSplit: SplitBillData | null;
  openSplitBillModal: (splitData: SplitBillData) => void;
  closeSplitBillModal: () => void;
};

const SplitBillContext = createContext<SplitBillContextType | undefined>(
  undefined
);

export function SplitBillProvider({ children }: { children: ReactNode }) {
  const [currentSplit, setCurrentSplit] = useState<SplitBillData | null>(null);

  const openSplitBillModal = (splitData: SplitBillData) => {
    setCurrentSplit(splitData);
  };

  const closeSplitBillModal = () => {
    setCurrentSplit(null);
  };

  return (
    <SplitBillContext.Provider
      value={{ currentSplit, openSplitBillModal, closeSplitBillModal }}
    >
      {children}
    </SplitBillContext.Provider>
  );
}

export function useSplitBillModal() {
  const context = useContext(SplitBillContext);
  if (!context) {
    throw new Error("useSplitBillModal must be used within SplitBillProvider");
  }
  return context;
}
