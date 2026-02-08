// src/app/g/[tag]/layout.tsx
// Standalone layout for guest portal — no app header/nav/auth
import type { Viewport } from "next";
import "../../globals.css";

export const metadata = {
  title: "Welcome Home • Jarvis Home Portal",
  description:
    "Your personal home assistant portal — powered by Jarvis AI ecosystem",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a1628",
};

export default function GuestPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#0a1628] text-white overflow-x-hidden">
      {children}
    </div>
  );
}
