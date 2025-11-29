"use client";

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { BarChart3, Wallet } from "lucide-react";

export type WebTab = "dashboard" | "budget";

type Props = {
  activeTab: WebTab;
  onTabChange: (tab: WebTab) => void;
};

const navItems: Array<{
  id: WebTab;
  icon: typeof BarChart3;
  label: string;
}> = [
  { id: "dashboard", icon: BarChart3, label: "Dashboard" },
  { id: "budget", icon: Wallet, label: "Budget" },
];

export default function WebBottomNav({ activeTab, onTabChange }: Props) {
  const themeClasses = useThemeClasses();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--header-bg)/0.95)] backdrop-blur-xl border-t border-[hsl(var(--header-border)/0.3)] shadow-2xl"
      style={{
        boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center gap-4 px-6 h-16">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(10);
                  onTabChange(item.id);
                }}
                className={cn(
                  "flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300",
                  "hover:scale-105 active:scale-95",
                  isActive
                    ? "neo-gradient text-white shadow-lg shadow-primary/30"
                    : `neo-card ${themeClasses.text} hover:bg-white/5`
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "drop-shadow-lg")} />
                <span className="text-sm font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
