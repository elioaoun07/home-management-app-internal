// src/app/nfc/[tag]/layout.tsx
// NFC tag layout — standalone dark layout like guest portal, but authenticated
import type { Viewport } from "next";
import "../../globals.css";

export const metadata = {
  title: "NFC Tag • ERA",
  description: "NFC tag interaction page",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a1628",
};

export default function NfcLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0a1628] text-white overflow-x-hidden">
      {children}
    </div>
  );
}
