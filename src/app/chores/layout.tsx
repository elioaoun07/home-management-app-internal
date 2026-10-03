import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chores • Home Manager",
  description: "Household chores for the week",
  icons: {
    icon: [
      { url: "/chores-192.png", sizes: "192x192", type: "image/png" },
      { url: "/chores-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/chores-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/chores-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifests/chores.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Chores",
  },
};

export default function ChoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
