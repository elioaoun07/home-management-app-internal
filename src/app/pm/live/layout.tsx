// src/app/pm/live/layout.tsx
// Standalone dark shell, same pattern as src/app/nfc/[tag]/layout.tsx — this
// is an owner-only ops tool, not a themed household module, so it doesn't
// hook into ThemeContext. ConditionalHeader / MobileNav hide on this route
// (see src/components/layouts/ConditionalHeader.tsx and MobileNav.tsx).
//
// `data-pm-live` scopes pm-live.css's token block to this subtree, so every
// surface below still resolves through a variable rather than a literal — the
// same contract as the themed app, just with its own palette.
import type { Metadata, Viewport } from "next";
import "./pm-live.css";

export const metadata: Metadata = {
  title: "PM Live • ERA",
  description: "Checklist, delivery and campaign command surface",
  icons: {
    icon: [
      { url: "/pm-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pm-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/pm-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/pm-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifests/pm-live.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PM Live",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a1628",
};

export default function PmLiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-pm-live className="min-h-[100dvh] overflow-x-hidden">
      {children}
    </div>
  );
}
