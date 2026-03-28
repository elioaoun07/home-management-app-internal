"use client";

import {
  LogOutIcon as LogOut,
  SettingsIcon,
  UserIcon,
} from "@/components/icons/FuturisticIcons";
import SettingsDialog from "@/components/settings/SettingsDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOnboarding } from "@/features/preferences/useOnboarding";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { createClient } from "@supabase/supabase-js";
import { WifiOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LinkHouseholdDialog from "./LinkHouseholdDialog";

type Props = {
  name: string;
  email: string;
  avatarUrl?: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UserMenuClient({ name, email, avatarUrl }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const { data: onboarding } = useOnboarding();
  const themeClasses = useThemeClasses();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    import("@/lib/connectivityManager").then((mod) => {
      setIsOffline(!mod.isReallyOnline());
    });
    const handler = (e: Event) => {
      setIsOffline(!((e as CustomEvent).detail?.online ?? true));
    };
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("connectivity-changed", handler);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("connectivity-changed", handler);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // Redirect to onboarding walkthrough for new users (except on auth/welcome routes)
  useEffect(() => {
    if (
      pathname === "/login" ||
      pathname.startsWith("/reset-password") ||
      pathname === "/welcome" ||
      pathname.startsWith("/auth/")
    ) {
      return;
    }
    if (onboarding && onboarding.completed === false) {
      router.replace("/welcome");
    }
  }, [pathname, router, onboarding]);

  // Never show the menu on auth pages
  if (pathname === "/login" || pathname.startsWith("/reset-password")) {
    return null;
  }

  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    // 1) Clear server-side cookies
    await fetch("/api/auth/signout", { method: "POST", cache: "no-store" });

    // 2) Also clear client-side session
    await supabase.auth.signOut();

    // 3) Navigate and refresh to drop any cached server components
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <LinkHouseholdDialog open={linkOpen} onOpenChange={setLinkOpen} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`relative flex items-center gap-1.5 p-1.5 h-auto rounded-lg backdrop-blur-sm transition-all ${
              isOffline
                ? "bg-amber-500/10 border border-amber-500/50 animate-pulse"
                : `${themeClasses.bgSurface} ${themeClasses.border} ${themeClasses.bgHover}`
            }`}
          >
            {isOffline && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
            )}
            {isOffline ? (
              <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center">
                <WifiOff className="h-3.5 w-3.5 text-amber-400" />
              </div>
            ) : (
              <Avatar className={`h-7 w-7 ${themeClasses.ringSelection}`}>
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={name} />
                ) : (
                  <AvatarFallback
                    className={`text-xs font-semibold ${themeClasses.bgSurface} ${themeClasses.labelText}`}
                  >
                    {initials || <UserIcon className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                )}
              </Avatar>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className={`w-64 p-2 ${themeClasses.modalBg} ${themeClasses.border}`}
        >
          {isOffline && (
            <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-amber-400">
                You&apos;re offline
              </span>
            </div>
          )}
          <DropdownMenuLabel className="px-3 py-2">
            <div className="flex items-center gap-3">
              <Avatar className={`h-10 w-10 ${themeClasses.ringSelection}`}>
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={name} />
                ) : (
                  <AvatarFallback
                    className={`text-sm font-semibold ${themeClasses.bgSurface} ${themeClasses.labelText}`}
                  >
                    {initials || <UserIcon className="h-5 w-5" />}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate text-white">{name}</div>
                <div
                  className={`text-xs ${themeClasses.headerTextMuted} truncate`}
                >
                  {email}
                </div>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className={themeClasses.separatorBg} />
          <DropdownMenuItem
            onClick={() => setSettingsOpen(true)}
            className={`cursor-pointer rounded-lg py-2.5 text-white ${themeClasses.hoverBgSubtle}`}
          >
            <SettingsIcon
              className={`mr-3 h-4 w-4 ${themeClasses.labelText}`}
            />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setLinkOpen(true)}
            className={`cursor-pointer rounded-lg py-2.5 text-white ${themeClasses.hoverBgSubtle}`}
          >
            <UserIcon className={`mr-3 h-4 w-4 ${themeClasses.labelText}`} />
            <span>Link household</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className={themeClasses.separatorBg} />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer rounded-lg py-2.5 text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="mr-3 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
