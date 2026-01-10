/**
 * Theme Color Utilities
 * Provides dynamic color classes based on the active theme
 */

export type Theme = "blue" | "pink" | "frost" | "calm";

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
  frost: {
    // Primary colors - Cool indigo/violet tones
    primary: "#6366f1",
    secondary: "#8b5cf6",
    accent: "#a78bfa",
    teal: "#14b8a6",

    // Backgrounds - Clean light mode
    bgDark: "#f8fafc",
    bgMedium: "#f1f5f9",
    bgCard: "#ffffff",

    // Tailwind classes
    classes: {
      text: {
        primary: "text-indigo-600",
        secondary: "text-violet-600",
        accent: "text-violet-500",
        teal: "text-teal-600",
      },
      bg: {
        primary: "bg-indigo-500",
        secondary: "bg-violet-500",
        dark: "bg-[#f8fafc]",
        medium: "bg-[#f1f5f9]",
        card: "bg-white",
        primaryLight: "bg-indigo-50",
        secondaryLight: "bg-violet-50",
        accentLight: "bg-indigo-100/50",
      },
      border: {
        primary: "border-slate-200",
        secondary: "border-slate-200/80",
        accent: "border-indigo-200/50",
      },
      hover: {
        bgPrimary: "hover:bg-indigo-50",
        bgSecondary: "hover:bg-violet-50",
        bgAccent: "hover:bg-indigo-100/50",
      },
      gradient: "bg-gradient-to-br from-indigo-500 via-violet-500 to-teal-500",
    },
  },
  calm: {
    // Primary colors - Warm, muted earth tones for tablet/calendar viewing
    primary: "#78716c", // Warm stone gray
    secondary: "#a8a29e", // Light stone
    accent: "#d6cfc7", // Warm cream accent
    teal: "#84a98c", // Sage green for positive

    // Backgrounds - Warm, paper-like tones (not too bright)
    bgDark: "#1c1917", // Warm charcoal (dark but not black)
    bgMedium: "#292524", // Warm dark stone
    bgCard: "#44403c", // Warm card surface

    // Tailwind classes
    classes: {
      text: {
        primary: "text-stone-300",
        secondary: "text-stone-400",
        accent: "text-stone-200",
        teal: "text-emerald-400",
      },
      bg: {
        primary: "bg-stone-600",
        secondary: "bg-stone-500",
        dark: "bg-[#1c1917]",
        medium: "bg-[#292524]",
        card: "bg-[#44403c]",
        primaryLight: "bg-stone-800",
        secondaryLight: "bg-stone-700",
        accentLight: "bg-stone-800/50",
      },
      border: {
        primary: "border-stone-700",
        secondary: "border-stone-700/80",
        accent: "border-stone-600/50",
      },
      hover: {
        bgPrimary: "hover:bg-stone-700",
        bgSecondary: "hover:bg-stone-600",
        bgAccent: "hover:bg-stone-700/50",
      },
      gradient: "bg-gradient-to-br from-stone-600 via-stone-500 to-emerald-600",
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
