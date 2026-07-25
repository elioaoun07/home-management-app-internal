// src/components/pm-live/shell/BottomNav.tsx
// Phone navigation. Hidden at lg, where SideNav takes over.
"use client";

import { NAV_ITEMS } from "./navItems";
import { useViewState } from "@/features/pm-live/viewState";

export function BottomNav() {
  const view = useViewState((s) => s.view);
  const setView = useViewState((s) => s.setView);
  const items = NAV_ITEMS.filter((item) => !item.desktopOnly);

  return (
    <nav
      className="lg:hidden shrink-0 grid border-t bg-[var(--pm-bg)]"
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        borderColor: "var(--pm-border)",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
      }}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            onClick={() => setView(id)}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-1 pt-2.5 pb-1.5 min-h-[52px]"
            style={{ color: active ? "var(--pm-accent)" : "var(--pm-fg-3)" }}
          >
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
