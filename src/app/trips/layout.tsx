import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trips • Home Manager",
  description: "Plan trips, track budgets, and manage packing lists and places",
  icons: {
    icon: [
      { url: "/trips-192.png", sizes: "192x192", type: "image/png" },
      { url: "/trips-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/trips-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/trips-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifests/trips.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trips",
  },
};

export default function TripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
