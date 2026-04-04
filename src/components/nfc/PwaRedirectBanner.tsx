"use client";

import { ExternalLink, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Detects if the page was opened in a browser instead of the installed PWA.
 * Shows a platform-specific banner guiding the user to open in the app.
 *
 * - Android: `handle_links: "preferred"` in manifest should auto-capture,
 *   but if it doesn't (older Chrome, not installed), show a manual banner.
 * - iOS A2HS: no link capture exists — always show the banner in Safari.
 */
export function PwaRedirectBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">(
    "other",
  );

  useEffect(() => {
    // Already running inside PWA — nothing to do
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    // Detect platform
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform("ios");
    } else if (/Android/i.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("other");
    }

    // Small delay so Android handle_links can capture first
    const timer = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="mx-3 mt-3 rounded-2xl border border-cyan-500/30 bg-[#0f1d35]/95 backdrop-blur-md p-4 shadow-lg shadow-cyan-500/10">
        <button
          onClick={() => setShow(false)}
          className="absolute right-3 top-3 rounded-full p-1 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pr-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20">
            <Smartphone size={18} className="text-cyan-400" />
          </div>

          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium text-white/90">
              Open in ERA App
            </p>

            {platform === "ios" ? (
              <p className="text-xs leading-relaxed text-white/50">
                Safari can&apos;t open this in the app directly. Open{" "}
                <strong className="text-white/70">ERA</strong> from your Home
                Screen, then tap the NFC tag again.
              </p>
            ) : platform === "android" ? (
              <p className="text-xs leading-relaxed text-white/50">
                If the app didn&apos;t open automatically, tap below or
                re-install the app to enable link capture.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-white/50">
                For the best experience, open this page in the installed app.
              </p>
            )}

            {platform === "android" && (
              <button
                onClick={() => {
                  // Re-trigger navigation — with handle_links: preferred,
                  // this may force the WebAPK intent filter to catch it
                  window.location.replace(window.location.href);
                }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/30"
              >
                <ExternalLink size={12} />
                Try opening in app
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
