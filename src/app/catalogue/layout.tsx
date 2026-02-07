import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catalogue • Smart Database",
  description:
    "Organize contacts, tasks, notes, recipes, and more in one place",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/catalogue-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
  manifest: "/manifests/catalogue.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Catalogue",
  },
};

export default function CatalogueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
