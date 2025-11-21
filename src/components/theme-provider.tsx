"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Load user's color theme preference
    const colorTheme = localStorage.getItem("color-theme") || "blue";
    document.documentElement.setAttribute("data-theme", colorTheme);

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "color-theme" && e.newValue) {
        document.documentElement.setAttribute("data-theme", e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="hm-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
