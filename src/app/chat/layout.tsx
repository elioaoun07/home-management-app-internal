import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hub Chat • Home Manager",
  description:
    "Chat with your household, share shopping lists, and coordinate together",
  icons: {
    icon: [
      { url: "/chat-192.png", sizes: "192x192", type: "image/png" },
      { url: "/chat-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/chat-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/chat-192.png", sizes: "192x192", type: "image/png" }],
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
