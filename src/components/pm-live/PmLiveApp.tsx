// src/components/pm-live/PmLiveApp.tsx
// Shell for /pm/live. Reads from `pm_live` (published by scripts/pm/bridge.mjs)
// and writes to `pm_commands` — it never talks to pm-server directly.
// See migrations/2026-07-25_pm-mobile-relay.sql.
//
// Phone-only (2026-07-31, PM Tooling): the previous shell carried a second,
// desktop-only layout in the same tree (a side rail + widget grid at `lg`),
// which forced every density decision here to negotiate with a desktop grid.
// A real desktop console already exists at /pm (public/pm.html) — this tree
// now serves the phone only.
"use client";

import { useRef, useState } from "react";
import { BottomNav } from "./shell/BottomNav";
import { TopBar } from "./shell/TopBar";
import { UndoStrip } from "./shell/UndoStrip";
import { CaptureSheet } from "./CaptureSheet";
import { LaunchSheet } from "./LaunchSheet";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { Sheet } from "./Sheet";
import { BoardView } from "./views/BoardView";
import { CampaignsView } from "./views/CampaignsView";
import { DeliveryView } from "./views/DeliveryView";
import { OverviewView } from "./views/OverviewView";
import { UsageView } from "./views/UsageView";
import { SessionDetailView } from "./session/SessionDetailView";
import { useBridge } from "@/features/pm-live/store";
import { usePmLoading } from "@/features/pm-live/store";
import { usePmCommand, usePmLiveConnection } from "@/features/pm-live/usePmLive";
import { useViewState, useViewStateUrlSync } from "@/features/pm-live/viewState";
import type { PmTask } from "@/features/pm-live/types";

function OverflowSheet({ onClose }: { onClose: () => void }) {
  const setView = useViewState((s) => s.setView);
  const bridge = useBridge();

  return (
    <Sheet title="More" onClose={onClose}>
      <div className="space-y-1">
        <button
          onClick={() => {
            setView("usage");
            onClose();
          }}
          className="pm-card w-full text-left px-3.5 py-3 text-[15px] font-medium"
          style={{ color: "var(--pm-fg-1)" }}
        >
          Usage — fleet spend &amp; tokens
        </button>
      </div>
      <p className="mt-4 text-[12px]" style={{ color: "var(--pm-fg-3)" }}>
        {bridge ? `Bridge pid ${bridge.pid} · up since ${new Date(bridge.startedAt).toLocaleString()}` : "No bridge heartbeat received yet."}
      </p>
    </Sheet>
  );
}

export function PmLiveApp() {
  usePmLiveConnection();
  useViewStateUrlSync();
  const sendCommand = usePmCommand();
  const view = useViewState((s) => s.view);
  const session = useViewState((s) => s.session);
  const loading = usePmLoading();

  const scrollRef = useRef<HTMLElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [launch, setLaunch] = useState<{ task: PmTask | null } | null>(null);
  const [detailTask, setDetailTask] = useState<PmTask | null>(null);

  function openLaunch(task: PmTask | null) {
    setDetailTask(null);
    setLaunch({ task });
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      <TopBar onOverflow={() => setOverflowOpen(true)} />
      <UndoStrip sendCommand={sendCommand} />

      {/* The scroll container lives here so BoardView can virtualize against
          it — every view scrolls in the same element. */}
      <main ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-[13px]" style={{ color: "var(--pm-fg-3)" }}>
            Loading…
          </p>
        ) : view === "overview" ? (
          <OverviewView />
        ) : view === "board" ? (
          <BoardView scrollRef={scrollRef} onOpenTask={setDetailTask} onLaunch={openLaunch} />
        ) : view === "delivery" ? (
          session ? (
            <SessionDetailView sessionId={session} sendCommand={sendCommand} />
          ) : (
            <DeliveryView sendCommand={sendCommand} onOpenLaunch={() => openLaunch(null)} />
          )
        ) : view === "usage" ? (
          <UsageView />
        ) : (
          <CampaignsView />
        )}
      </main>

      <BottomNav onCapture={() => setCaptureOpen(true)} onQuickLaunch={() => openLaunch(null)} />

      {captureOpen && <CaptureSheet onClose={() => setCaptureOpen(false)} sendCommand={sendCommand} />}
      {overflowOpen && <OverflowSheet onClose={() => setOverflowOpen(false)} />}
      {detailTask && <TaskDetailSheet task={detailTask} onClose={() => setDetailTask(null)} onLaunch={openLaunch} />}
      {launch && <LaunchSheet initialTask={launch.task} onClose={() => setLaunch(null)} sendCommand={sendCommand} />}
    </div>
  );
}
