"use client";

import UserMenuClient from "@/components/auth/UserMenuClient";
import { NotificationCenter } from "@/components/notifications";
import { useTab } from "@/contexts/TabContext";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import { ChevronLeft, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  // Hide header on guest portal and in watch/web mode
  if (
    pathname?.startsWith("/g/") ||
    viewMode === "watch" ||
    viewMode === "web"
  ) {
    return null;
  }

  // Check if this is a standalone app route
  const standaloneApp = Object.entries(STANDALONE_APPS).find(([route]) =>
    pathname?.startsWith(route),
  );

  // Render standalone header for standalone apps
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

  // Always show header with UserMenu on all tabs
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
