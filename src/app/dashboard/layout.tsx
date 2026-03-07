import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard • Budget Manager",
  description:
    "View your spending overview, track balances, and analyze budget trends",
  icons: {
    icon: [
      { url: "/dashboard-192.png", sizes: "192x192", type: "image/png" },
      { url: "/dashboard-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/dashboard-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/dashboard-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifests/dashboard.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dashboard",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
