"use client";

import { Button } from "@/components/ui/button";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { useViewMode } from "@/hooks/useViewMode";
import Link from "next/link";

export default function GuestHeader() {
  const { viewMode, isLoaded } = useViewMode();
  const themeClasses = useThemeClasses();

  // Hide header in watch/web mode - after all hooks are called
  if (!isLoaded || viewMode === "watch" || viewMode === "web") {
    return null;
  }

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
      <Link href="/login">
        <Button
          variant="default"
          size="sm"
          className="neo-gradient text-white shadow-lg hover:scale-105 transition-transform"
        >
          Login
        </Button>
      </Link>
    </header>
  );
}
