// src/components/pm-live/shell/TopBar.tsx
// The title/status row. On desktop the title and bridge chip live in SideNav,
// so this collapses to the current view name plus the capture action.
"use client";

import { Plus } from "lucide-react";
import { BridgeStatusChip } from "../BridgeStatusChip";
import { NAV_ITEMS } from "./navItems";
import { useViewState } from "@/features/pm-live/viewState";

export function TopBar({ onCapture }: { onCapture: () => void }) {
  const view = useViewState((s) => s.view);
  const label = NAV_ITEMS.find((item) => item.id === view)?.label ?? "PM Live";

  return (
    <header
      className="shrink-0 flex items-center gap-3 px-4 border-b"
      style={{
        borderColor: "var(--pm-border)",
        // Hard Rule 16: this bar is in-flow inside a flex column, so the
        // scrolling <main> below it can never slide underneath.
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "12px",
      }}
    >
      <h1 className="text-[15px] font-semibold lg:text-[17px]" style={{ color: "var(--pm-fg-1)" }}>
        <span className="lg:hidden">PM Live</span>
        <span className="hidden lg:inline">{label}</span>
      </h1>

      <div className="ml-auto flex items-center gap-2">
        <span className="lg:hidden">
          <BridgeStatusChip />
        </span>
        <button onClick={onCapture} className="pm-btn" title="Capture an idea to the PM Inbox">
          <Plus size={14} />
          <span className="hidden sm:inline">Capture</span>
        </button>
      </div>
    </header>
  );
}
