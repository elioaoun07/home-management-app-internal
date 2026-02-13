import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hub Chat • Home Manager",
  description:
    "Chat with your household, share shopping lists, and coordinate together",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/chat-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
  },
  manifest: "/manifests/chat.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hub Chat",
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
