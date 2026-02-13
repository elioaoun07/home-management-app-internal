import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reminders • Home Manager",
  description:
    "Track your tasks, reminders, and stay organized with your household",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/reminders-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
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
