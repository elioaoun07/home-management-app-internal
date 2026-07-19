import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outfits • Home Manager",
  description:
    "Wardrobe catalog, paper-doll outfit builder, weekly outfit planner and wear log",
  icons: {
    icon: [
      { url: "/outfits-192.png", sizes: "192x192", type: "image/png" },
      { url: "/outfits-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/outfits-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/outfits-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifests/outfits.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Outfits",
  },
};

export default function OutfitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
