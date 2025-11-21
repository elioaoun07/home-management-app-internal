/**
 * Theme Color Utilities
 * Provides dynamic color classes based on the active theme
 */

export type Theme = "blue" | "pink";

export const themeColors = {
  blue: {
    // Primary colors
    primary: "#3b82f6",
    secondary: "#06b6d4",
    accent: "#38bdf8",
    teal: "#14b8a6",

    // Backgrounds
    bgDark: "#0a1628",
    bgMedium: "#0f1d2e",
    bgCard: "#1a2942",

    // Tailwind classes
    classes: {
      text: {
        primary: "text-[#06b6d4]",
        secondary: "text-[#38bdf8]",
        accent: "text-[#38bdf8]/80",
        teal: "text-[#14b8a6]",
      },
      bg: {
        primary: "bg-[#3b82f6]",
        secondary: "bg-[#06b6d4]",
        dark: "bg-[#0a1628]",
        medium: "bg-[#0f1d2e]",
        card: "bg-[#1a2942]",
        primaryLight: "bg-[#3b82f6]/10",
        secondaryLight: "bg-[#06b6d4]/10",
        accentLight: "bg-[#38bdf8]/10",
      },
      border: {
        primary: "border-[#3b82f6]/20",
        secondary: "border-[#3b82f6]/30",
        accent: "border-[#38bdf8]/30",
      },
      hover: {
        bgPrimary: "hover:bg-[#3b82f6]/20",
        bgSecondary: "hover:bg-[#06b6d4]/20",
        bgAccent: "hover:bg-[#38bdf8]/20",
      },
      gradient: "bg-gradient-to-br from-[#3b82f6] via-[#06b6d4] to-[#14b8a6]",
    },
  },
  pink: {
    // Primary colors
    primary: "#ec4899",
    secondary: "#f472b6",
    accent: "#f9a8d4",
    teal: "#fbbf24",

    // Backgrounds
    bgDark: "#1a0a14",
    bgMedium: "#2d1b29",
    bgCard: "#3d2435",

    // Tailwind classes
    classes: {
      text: {
        primary: "text-[#f472b6]",
        secondary: "text-[#f9a8d4]",
        accent: "text-[#f9a8d4]/80",
        teal: "text-[#fbbf24]",
      },
      bg: {
        primary: "bg-[#ec4899]",
        secondary: "bg-[#f472b6]",
        dark: "bg-[#1a0a14]",
        medium: "bg-[#2d1b29]",
        card: "bg-[#3d2435]",
        primaryLight: "bg-[#ec4899]/10",
        secondaryLight: "bg-[#f472b6]/10",
        accentLight: "bg-[#f9a8d4]/10",
      },
      border: {
        primary: "border-[#ec4899]/20",
        secondary: "border-[#ec4899]/30",
        accent: "border-[#f9a8d4]/30",
      },
      hover: {
        bgPrimary: "hover:bg-[#ec4899]/20",
        bgSecondary: "hover:bg-[#f472b6]/20",
        bgAccent: "hover:bg-[#f9a8d4]/20",
      },
      gradient: "bg-gradient-to-br from-[#ec4899] via-[#f472b6] to-[#fbbf24]",
    },
  },
};

/**
 * Get theme-specific color classes
 */
export function getThemeClasses(theme: Theme) {
  return themeColors[theme].classes;
}

/**
 * Get theme-specific hex colors
 */
export function getThemeColors(theme: Theme) {
  return {
    primary: themeColors[theme].primary,
    secondary: themeColors[theme].secondary,
    accent: themeColors[theme].accent,
    teal: themeColors[theme].teal,
    bgDark: themeColors[theme].bgDark,
    bgMedium: themeColors[theme].bgMedium,
    bgCard: themeColors[theme].bgCard,
  };
}
