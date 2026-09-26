import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity · ERA",
  description: "Household activity",
  manifest: "/manifests/activity-log.webmanifest",
  icons: {
    icon: [
      { url: "/activity-log-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/activity-log-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Activity" },
};

export default function ActivityLogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
