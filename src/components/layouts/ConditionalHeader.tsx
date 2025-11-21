"use client";

import UserMenuClient from "@/components/auth/UserMenuClient";
import { useTab } from "@/contexts/TabContext";

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

  // Always show header with UserMenu on all tabs
  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-md border-b border-[hsl(var(--header-border)/0.2)] flex items-center justify-between px-4 z-50">
      <h1 className="text-base font-bold text-white/90">Budget Manager</h1>
      <UserMenuClient name={userName} email={userEmail} avatarUrl={avatarUrl} />
    </div>
  );
}
