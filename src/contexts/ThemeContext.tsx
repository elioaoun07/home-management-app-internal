"use client";

import ThemeTransition from "@/components/ThemeTransition";
import { useUserPreferences } from "@/features/preferences/useUserPreferences";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

type Theme = "blue" | "pink";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Get initial theme from localStorage to prevent flash
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "blue";
  const stored = localStorage.getItem("color-theme");
  if (stored === "pink" || stored === "blue") return stored;
  return "blue";
}

// Apply theme to DOM immediately - no React state delay
function applyThemeToDOM(newTheme: Theme) {
  const bgColor = newTheme === "pink" ? "#1a0a14" : "#0a1628";
  document.documentElement.setAttribute("data-theme", newTheme);
  document.documentElement.style.backgroundColor = bgColor;
  document.body.style.backgroundColor = bgColor;

  // Force all theme-dependent CSS to update
  document.documentElement.style.setProperty("--theme-bg", bgColor);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTo, setTransitionTo] = useState<Theme>("pink");
  const queryClient = useQueryClient();
  const pendingThemeRef = useRef<Theme | null>(null);
  const { data: preferences } = useUserPreferences();

  // Sync with database preferences
  useEffect(() => {
    if (preferences?.theme) {
      const userTheme = preferences.theme as Theme;
      if (
        (userTheme === "blue" || userTheme === "pink") &&
        userTheme !== theme
      ) {
        setThemeState(userTheme);
        applyThemeToDOM(userTheme);
        localStorage.setItem("color-theme", userTheme);
      }
    }
  }, [preferences, theme]);

  // Apply theme on mount
  useEffect(() => {
    const currentTheme = getInitialTheme();
    applyThemeToDOM(currentTheme);
  }, []);

  // Called when paint has FULLY covered the screen
  const handlePaintCovered = useCallback(async () => {
    const newTheme = pendingThemeRef.current;
    if (!newTheme) return;

    // NOW apply the theme - user can't see because paint covers everything!
    applyThemeToDOM(newTheme);
    setThemeState(newTheme);

    // Invalidate all queries to refresh with new theme colors
    // This ensures any theme-dependent data is fresh
    await queryClient.invalidateQueries();

    // Small delay to let React re-render with new theme
    await new Promise((resolve) => setTimeout(resolve, 100));
  }, [queryClient]);

  // Called when animation is fully complete
  const handleTransitionComplete = useCallback(() => {
    setIsTransitioning(false);
    pendingThemeRef.current = null;
  }, []);

  const setTheme = async (newTheme: Theme) => {
    if (newTheme === theme || isTransitioning) return;

    setIsLoading(true);
    pendingThemeRef.current = newTheme;
    setTransitionTo(newTheme);

    // Save to localStorage FIRST - ensures theme persists even if API fails
    localStorage.setItem("color-theme", newTheme);

    try {
      // Save to database
      const res = await fetch("/api/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });

      if (!res.ok) throw new Error("Failed to save theme");

      // Start the beautiful paint animation!
      setIsTransitioning(true);

      toast.success(
        `🎨 ${newTheme === "blue" ? "Blue Ocean" : "Pink Sunset"} theme!`,
        { duration: 2000 }
      );
    } catch (error) {
      console.error("Failed to save theme:", error);
      toast.error("Failed to save theme preference");
      // Revert localStorage on error
      localStorage.setItem("color-theme", theme);
      pendingThemeRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>
      {children}
      <ThemeTransition
        isTransitioning={isTransitioning}
        toTheme={transitionTo}
        onPaintCovered={handlePaintCovered}
        onComplete={handleTransitionComplete}
      />
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
