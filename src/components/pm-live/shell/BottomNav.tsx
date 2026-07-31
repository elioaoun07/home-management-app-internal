// src/components/pm-live/shell/BottomNav.tsx
// Phone nav: 4 tabs + a raised centre Capture FAB, modelled on
// src/components/layouts/MobileNav.tsx's own -mt-8 raised-FAB shape so the
// house feels consistent across every mobile surface. A tap captures an idea
// to the Inbox; a long-press (500ms, same threshold as SemiDonutFAB) opens the
// Launch sheet directly — the two most common one-handed actions on this
// surface, one thumb reach apart.
"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { TAB_ITEMS } from "./navItems";
import { useActiveSessions } from "@/features/pm-live/selectors";
import { useViewState } from "@/features/pm-live/viewState";

const LONG_PRESS_MS = 500;

export function BottomNav({ onCapture, onQuickLaunch }: { onCapture: () => void; onQuickLaunch: () => void }) {
  const view = useViewState((s) => s.view);
  const setView = useViewState((s) => s.setView);
  const active = useActiveSessions();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedLongPress = useRef(false);

  const half = Math.ceil(TAB_ITEMS.length / 2);
  const left = TAB_ITEMS.slice(0, half);
  const right = TAB_ITEMS.slice(half);

  function tab(item: (typeof TAB_ITEMS)[number]) {
    const isActive = view === item.id;
    const badge = item.id === "delivery" && active.length ? active.length : null;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if (navigator.vibrate) navigator.vibrate(10);
          setView(item.id);
        }}
        aria-current={isActive ? "page" : undefined}
        className="relative flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-2xl transition-all min-w-[56px] min-h-[56px] active:scale-95"
        style={{ color: isActive ? "var(--pm-accent)" : "var(--pm-fg-3)" }}
      >
        <item.icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
        <span className="text-[11px] font-medium">{item.label}</span>
        {badge != null && (
          <span
            className="absolute top-1 right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-center"
            style={{ backgroundColor: "var(--pm-accent)", color: "var(--pm-accent-ink)" }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  }

  function startPress() {
    firedLongPress.current = false;
    timerRef.current = setTimeout(() => {
      firedLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      onQuickLaunch();
    }, LONG_PRESS_MS);
  }

  function endPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!firedLongPress.current) {
      if (navigator.vibrate) navigator.vibrate(10);
      onCapture();
    }
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <nav
      className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-end border-t"
      style={{
        borderColor: "var(--pm-border)",
        backgroundColor: "var(--pm-bg)",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
      }}
    >
      <div className="flex items-center justify-evenly">{left.map(tab)}</div>

      <div className="flex flex-col items-center -mt-7 px-3">
        <button
          type="button"
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          aria-label="Capture an idea — hold to launch a delivery session"
          className="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
          style={{
            backgroundColor: "var(--pm-accent)",
            color: "var(--pm-accent-ink)",
            boxShadow: "0 8px 24px var(--pm-accent-glow), 0 2px 8px rgb(0 0 0 / 35%)",
          }}
        >
          <Plus size={24} strokeWidth={2.4} />
        </button>
        <span className="text-[10px] font-semibold mt-1" style={{ color: "var(--pm-fg-2)" }}>
          Capture
        </span>
      </div>

      <div className="flex items-center justify-evenly">{right.map(tab)}</div>
    </nav>
  );
}
