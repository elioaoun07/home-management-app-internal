// src/components/pm-live/BridgeStatusChip.tsx
// Liveness of the laptop bridge. Every action on this surface is executed by
// scripts/pm/bridge.mjs, so "is the laptop there" is the one piece of status
// that belongs on every view.
"use client";

import { useBridge, useBridgeLive, usePmLiveStore } from "@/features/pm-live/store";

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function BridgeStatusChip() {
  const bridge = useBridge();
  const live = useBridgeLive();
  // Subscribing to the tick HERE, and only here, is what stops the 10s
  // heartbeat from re-rendering the board behind it.
  const now = usePmLiveStore((s) => s.nowTick);

  return (
    <span
      className="pm-chip"
      title={bridge ? `pid ${bridge.pid} · up since ${new Date(bridge.startedAt).toLocaleString()}` : "no heartbeat received yet"}
    >
      <span
        aria-hidden
        className={`w-1.5 h-1.5 rounded-full ${live ? "bg-[var(--pm-ok)]" : "bg-[var(--pm-warn)]"}`}
      />
      <span className={live ? "text-[var(--pm-fg-2)]" : "text-[var(--pm-warn)]"}>
        {live ? "Live" : bridge ? `Laptop offline · ${timeAgo(bridge.seenAt, now)}` : "Laptop offline"}
      </span>
    </span>
  );
}
