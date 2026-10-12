import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fitness • Home Manager",
  description: "Imported PT plans, workout logging, recovery and progress",
  icons: {
    icon: [
      { url: "/fitness-192.png", sizes: "192x192", type: "image/png" },
      { url: "/fitness-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/fitness-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/fitness-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifests/fitness.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fitness",
  },
};

export default function FitnessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
