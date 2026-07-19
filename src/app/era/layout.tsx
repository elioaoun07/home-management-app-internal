import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ERA • Home Manager",
  description: "Your ERA assistant and memory hub",
  icons: {
    icon: [
      { url: "/era-192.png", sizes: "192x192", type: "image/png" },
      { url: "/era-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/era-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/era-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifests/era.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ERA",
  },
};

export default function EraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
