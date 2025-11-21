"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Load user's color theme preference
    const colorTheme = localStorage.getItem("user-color-theme") || "blue";
    document.documentElement.setAttribute("data-theme", colorTheme);
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
