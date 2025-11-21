"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Color theme (blue/pink) is now handled by ThemeContext
  // This provider only handles dark/light mode
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
