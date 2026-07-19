import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Healthcare • Home Manager",
  description:
    "Track appointments, medications, and health records for your household",
  icons: {
    icon: [
      { url: "/healthcare-192.png", sizes: "192x192", type: "image/png" },
      { url: "/healthcare-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/healthcare-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/healthcare-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifests/healthcare.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Healthcare",
  },
};

export default function HealthcareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
