import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reminders • Home Manager",
  description:
    "Track your tasks, reminders, and stay organized with your household",
  icons: {
    icon: [
      { url: "/reminders-192.png", sizes: "192x192", type: "image/png" },
      { url: "/reminders-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/reminders-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/reminders-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifests/reminders.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reminders",
  },
};

export default function RemindersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
