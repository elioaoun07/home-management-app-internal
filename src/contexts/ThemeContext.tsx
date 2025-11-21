"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

type Theme = "blue" | "pink";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("blue");
  const [isLoading, setIsLoading] = useState(false);

  // Load theme on mount from user preferences API
  useEffect(() => {
    async function loadTheme() {
      try {
        const res = await fetch("/api/user-preferences");
        if (res.ok) {
          const data = await res.json();
          const userTheme = data.theme as Theme;
          if (userTheme === "blue" || userTheme === "pink") {
            setThemeState(userTheme);
            document.documentElement.setAttribute("data-theme", userTheme);
          }
        }
      } catch (error) {
        console.error("Failed to load theme:", error);
        // Fallback to blue
        document.documentElement.setAttribute("data-theme", "blue");
      }
    }
    loadTheme();
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setIsLoading(true);
    try {
      // Update UI immediately
      setThemeState(newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);

      // Save to database
      const res = await fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });

      if (!res.ok) {
        throw new Error("Failed to save theme");
      }

      toast.success(
        `🎨 Theme updated to ${newTheme === "blue" ? "Blue Ocean" : "Pink Sunset"}!`
      );
    } catch (error) {
      console.error("Failed to save theme:", error);
      toast.error("Failed to save theme preference");
      // Revert on error
      setThemeState(theme);
      document.documentElement.setAttribute("data-theme", theme);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
