"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { Download, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Chrome Android's ⋮ menu install (Universal Install) reports "This app is already installed"
// whenever ANY of our apps is installed on this origin (WebappRegistry.isAppInstalledForUrl →
// hasAtLeastOneWebApkForOrigin), whatever the manifest scope. The page-triggered prompt
// (beforeinstallprompt → prompt()) only checks the app's own start_url, so it can still install
// Chores, Chat, Trips… side by side. See .claude/skills/pwa-install/SKILL.md.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Pages with their own install control.
const OWN_INSTALL_UI = ["/activity-log"];

const manifestHref = () =>
  document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? "";

// Session-only on purpose: the ⋮ menu cannot install a second app, so a permanent dismiss
// would leave no install path at all.
const dismissKey = (manifest: string) => `pwa-install-dismissed:${manifest}`;

export function InstallAppPrompt() {
  const tc = useThemeClasses();
  const pathname = usePathname();
  const [captured, setCaptured] = useState<{
    event: InstallPromptEvent;
    manifest: string;
  } | null>(null);
  const [currentManifest, setCurrentManifest] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setCaptured({
        event: event as InstallPromptEvent,
        manifest: manifestHref(),
      });
    };
    const installed = () => setCaptured(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  // The manifest <link> changes on client-side navigation between apps.
  useEffect(() => {
    const manifest = manifestHref();
    setCurrentManifest(manifest);
    try {
      setDismissed(sessionStorage.getItem(dismissKey(manifest)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [pathname]);

  if (
    !captured ||
    dismissed ||
    captured.manifest !== currentManifest ||
    OWN_INSTALL_UI.some((route) => pathname?.startsWith(route)) ||
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return null;
  }

  const install = async () => {
    try {
      await captured.event.prompt();
      await captured.event.userChoice;
    } catch {
      // A prompt can only be used once; Chrome re-fires the event if still installable.
    } finally {
      setCaptured(null);
    }
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey(captured.manifest), "1");
    } catch {
      // Storage unavailable — hidden until the next page load.
    }
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 shadow-2xl",
        "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]",
        tc.bgPage,
        tc.border,
      )}
    >
      <button
        type="button"
        onClick={install}
        className={cn(
          "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold",
          tc.bgHover,
          tc.text,
        )}
      >
        <Download size={16} />
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          tc.textMuted,
        )}
      >
        <X size={16} />
      </button>
    </div>
  );
}
