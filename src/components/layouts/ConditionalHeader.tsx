"use client";

import UserMenuClient from "@/components/auth/UserMenuClient";
import { NotificationCenter } from "@/components/notifications";
import { useTab } from "@/contexts/TabContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import { ChevronLeft, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Standalone app configuration
const STANDALONE_APPS: Record<
  string,
  { title: string; color: string; hideNavigation?: boolean }
> = {
  "/catalogue": {
    title: "Catalogue",
    color: "from-emerald-400 to-emerald-600",
  },
  "/recipe": { title: "Recipes", color: "from-orange-400 to-orange-600" },
  "/chat": {
    title: "Hub Chat",
    color: "from-cyan-400 to-cyan-600",
    hideNavigation: true,
  },
  "/reminders": { title: "Reminders", color: "from-amber-400 to-amber-600" },
  "/alerts": { title: "Notifications", color: "from-blue-400 to-purple-500" },
};

type Props = {
  userName: string;
  userEmail: string;
  avatarUrl?: string;
};

export default function ConditionalHeader({
  userName,
  userEmail,
  avatarUrl,
}: Props) {
  const { activeTab } = useTab();
  const { viewMode } = useViewMode();
  const themeClasses = useThemeClasses();
  const pathname = usePathname();

  // Defer route-dependent rendering until after hydration to prevent
  // SSR/client mismatch when PWA service worker serves cached HTML
  // from a different route.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Evaluate hide/standalone conditions only after mount to avoid hydration
  // mismatch. Before mount, always falls through to the default header
  // (matches any server-rendered or SW-cached HTML).
  const shouldHide =
    mounted &&
    (pathname?.startsWith("/g/") ||
      pathname?.startsWith("/temp") ||
      pathname?.startsWith("/nfc/") ||
      viewMode === "watch" ||
      viewMode === "web");

  if (shouldHide) {
    return null;
  }

  const standaloneApp = mounted
    ? Object.entries(STANDALONE_APPS).find(([route]) =>
        pathname?.startsWith(route),
      )
    : null;

  // Render standalone header for standalone apps (only after mount)
  if (standaloneApp) {
    const [, config] = standaloneApp;
    return (
      <header className="fixed top-0 left-0 right-0 h-14 bg-[hsl(var(--header-bg)/0.98)] backdrop-blur-xl border-b border-[hsl(var(--header-border)/0.3)] flex items-center justify-between px-3 z-50 shadow-lg shadow-black/5">
        <div className="flex items-center gap-2">
          {!config.hideNavigation && (
            <Link
              href="/expense"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Back to main app"
            >
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </Link>
          )}
          <h1
            className={`text-base font-bold bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}
          >
            {config.title}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {!config.hideNavigation && (
            <Link
              href="/expense"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
              aria-label="Home"
            >
              <Home className="w-4 h-4 text-white/70" />
            </Link>
          )}
          <NotificationCenter />
          <UserMenuClient
            name={userName}
            email={userEmail}
            avatarUrl={avatarUrl}
          />
        </div>
      </header>
    );
  }

  // Default header (also used as initial SSR render for all routes)
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[hsl(var(--header-bg)/0.98)] backdrop-blur-xl border-b border-[hsl(var(--header-border)/0.3)] flex items-center justify-between px-4 z-50 shadow-lg shadow-black/5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="text-white font-bold text-sm">B</span>
        </div>
        <h1
          className={`text-base font-bold bg-gradient-to-r ${themeClasses.titleGradient} bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(20,184,166,0.4)]`}
        >
          Budget Manager
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <NotificationCenter />
        <UserMenuClient
          name={userName}
          email={userEmail}
          avatarUrl={avatarUrl}
        />
      </div>
    </header>
  );
}
