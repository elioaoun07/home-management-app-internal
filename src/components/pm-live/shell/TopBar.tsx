// src/components/pm-live/shell/TopBar.tsx
// Phone-only title row. The bridge status chip is always visible now — on the
// old dual-layout tree it only showed up here below `lg`, because desktop had
// its own copy in SideNav. Usage is a pushed screen reached from Home's Spend
// widget rather than a tab, so this bar grows a back chevron for it; the
// session detail screen renders its own back affordance internally and never
// triggers this one.
"use client";

import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { BridgeStatusChip } from "../BridgeStatusChip";
import { useViewState } from "@/features/pm-live/viewState";

export function TopBar({ onOverflow }: { onOverflow: () => void }) {
  const view = useViewState((s) => s.view);
  const setView = useViewState((s) => s.setView);
  const isPushed = view === "usage";

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
      {isPushed ? (
        <button
          onClick={() => setView("overview")}
          className="flex items-center gap-1.5 -ml-1 p-1"
          aria-label="Back to Home"
        >
          <ArrowLeft size={20} style={{ color: "var(--pm-fg-1)" }} />
        </button>
      ) : null}

      <h1 className="text-[18px] font-semibold" style={{ color: "var(--pm-fg-1)" }}>
        {isPushed ? "Usage" : "ERA · PM"}
      </h1>

      <div className="ml-auto flex items-center gap-2">
        <BridgeStatusChip />
        <button onClick={onOverflow} className="p-2 -mr-2 rounded-xl" aria-label="More">
          <MoreHorizontal size={20} style={{ color: "var(--pm-fg-2)" }} />
        </button>
      </div>
    </header>
  );
}
