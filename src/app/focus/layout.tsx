import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Focus • Home Manager",
  description:
    "View and manage your tasks, reminders, and events in one focused view",
  manifest: "/manifests/focus.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Focus",
  },
};

export default function FocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
