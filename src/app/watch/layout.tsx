import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ERA Watch",
  description: "ERA on your wrist",
  manifest: "/manifests/watch.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ERA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#06b6d4",
};

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
