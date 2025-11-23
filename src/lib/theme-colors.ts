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
        primary: "text-secondary",
        secondary: "text-accent",
        accent: "text-accent/80",
        teal: "text-teal",
      },
      bg: {
        primary: "bg-primary",
        secondary: "bg-secondary",
        dark: "bg-bg-dark",
        medium: "bg-bg-medium",
        card: "bg-bg-card-custom",
        primaryLight: "bg-primary/10",
        secondaryLight: "bg-secondary/10",
        accentLight: "bg-accent/10",
      },
      border: {
        primary: "border-[#1a2942]",
        secondary: "border-[#1a2942]/80",
        accent: "border-accent/30",
      },
      hover: {
        bgPrimary: "hover:bg-primary/20",
        bgSecondary: "hover:bg-secondary/20",
        bgAccent: "hover:bg-accent/20",
      },
      gradient: "bg-gradient-to-br from-primary via-secondary to-teal",
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
        primary: "text-secondary",
        secondary: "text-accent",
        accent: "text-accent/80",
        teal: "text-teal",
      },
      bg: {
        primary: "bg-primary",
        secondary: "bg-secondary",
        dark: "bg-bg-dark",
        medium: "bg-bg-medium",
        card: "bg-bg-card-custom",
        primaryLight: "bg-primary/10",
        secondaryLight: "bg-secondary/10",
        accentLight: "bg-accent/10",
      },
      border: {
        primary: "border-[#2d1b29]",
        secondary: "border-[#2d1b29]/80",
        accent: "border-accent/30",
      },
      hover: {
        bgPrimary: "hover:bg-primary/20",
        bgSecondary: "hover:bg-secondary/20",
        bgAccent: "hover:bg-accent/20",
      },
      gradient: "bg-gradient-to-br from-primary via-secondary to-teal",
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
