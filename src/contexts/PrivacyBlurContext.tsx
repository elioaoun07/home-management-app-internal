"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

type PrivacyBlurContextType = {
  isBlurred: boolean;
  toggleBlur: () => void;
  setBlurred: (value: boolean) => void;
};

const PrivacyBlurContext = createContext<PrivacyBlurContextType | undefined>(
  undefined,
);

export function PrivacyBlurProvider({ children }: { children: ReactNode }) {
  // Default to blurred for privacy
  const [isBlurred, setIsBlurred] = useState(true);

  const toggleBlur = useCallback(() => {
    setIsBlurred((prev) => !prev);
  }, []);

  const setBlurred = useCallback((value: boolean) => {
    setIsBlurred(value);
  }, []);

  return (
    <PrivacyBlurContext.Provider value={{ isBlurred, toggleBlur, setBlurred }}>
      {children}
    </PrivacyBlurContext.Provider>
  );
}

export function usePrivacyBlur() {
  const context = useContext(PrivacyBlurContext);
  if (context === undefined) {
    throw new Error("usePrivacyBlur must be used within a PrivacyBlurProvider");
  }
  return context;
}
