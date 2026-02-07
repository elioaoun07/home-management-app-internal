import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recipes • Meal Planner & Cookbook",
  description:
    "Plan meals, collect recipes, cook with step-by-step guidance, and get AI suggestions",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/recipe-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
  manifest: "/manifests/recipe.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Recipes",
  },
};

export default function RecipeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
