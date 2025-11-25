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
            className={`flex items-center gap-1.5 p-1.5 h-auto rounded-lg ${themeClasses.bgSurface} backdrop-blur-sm ${themeClasses.border} ${themeClasses.bgHover} transition-all`}
          >
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
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className={`w-64 p-2 ${themeClasses.modalBg} ${themeClasses.border}`}
        >
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
