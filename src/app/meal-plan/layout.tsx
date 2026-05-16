import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meal Planning • Weekly Diet Planner",
  description:
    "Plan your weekly meals, assign recipes by day and meal type, and track leftovers.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/meal-plan-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
  manifest: "/manifests/meal-plan.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Meal Plan",
  },
};

export default function MealPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
