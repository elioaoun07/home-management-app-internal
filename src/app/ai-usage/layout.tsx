// src/app/ai-usage/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Usage • Home Manager",
  description: "Track your AI token consumption, pace, and forecasts.",
  icons: {
    icon: [
      { url: "/ai-usage-192.png", sizes: "192x192", type: "image/png" },
      { url: "/ai-usage-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/ai-usage-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/ai-usage-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifests/ai-usage.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Usage",
  },
};

export default function AIUsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
