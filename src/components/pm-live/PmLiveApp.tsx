// src/components/pm-live/PmLiveApp.tsx
// Shell for /pm/live. Reads from `pm_live` (published by scripts/pm/bridge.mjs)
// and writes to `pm_commands` — it never talks to pm-server directly.
// See migrations/2026-07-25_pm-mobile-relay.sql.
//
// One component tree, two layouts: bottom nav + single column under lg, side
// rail + widget grid at lg and up. Nothing branches on a user-agent sniff.
"use client";

import { useRef, useState } from "react";
import { BottomNav } from "./shell/BottomNav";
import { SideNav } from "./shell/SideNav";
import { TopBar } from "./shell/TopBar";
import { UndoStrip } from "./shell/UndoStrip";
import { CaptureSheet } from "./CaptureSheet";
import { LaunchSheet } from "./LaunchSheet";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { BoardView } from "./views/BoardView";
import { CampaignsView } from "./views/CampaignsView";
import { DeliveryView } from "./views/DeliveryView";
import { OverviewView } from "./views/OverviewView";
import { UsageView } from "./views/UsageView";
import { usePmLoading } from "@/features/pm-live/store";
import { usePmCommand, usePmLiveConnection } from "@/features/pm-live/usePmLive";
import { useViewState, useViewStateUrlSync } from "@/features/pm-live/viewState";
import type { PmTask } from "@/features/pm-live/types";

export function PmLiveApp() {
  usePmLiveConnection();
  useViewStateUrlSync();
  const sendCommand = usePmCommand();
  const view = useViewState((s) => s.view);
  const loading = usePmLoading();

  const scrollRef = useRef<HTMLElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [launch, setLaunch] = useState<{ task: PmTask | null } | null>(null);
  const [detailTask, setDetailTask] = useState<PmTask | null>(null);

  function openLaunch(task: PmTask | null) {
    setDetailTask(null);
    setLaunch({ task });
  }

  return (
    <div className="flex h-[100dvh]">
      <SideNav />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onCapture={() => setCaptureOpen(true)} />
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
            <DeliveryView sendCommand={sendCommand} onOpenLaunch={() => openLaunch(null)} />
          ) : view === "usage" ? (
            <UsageView />
          ) : (
            <CampaignsView />
          )}
        </main>

        <BottomNav />
      </div>

      {captureOpen && <CaptureSheet onClose={() => setCaptureOpen(false)} sendCommand={sendCommand} />}
      {detailTask && <TaskDetailSheet task={detailTask} onClose={() => setDetailTask(null)} onLaunch={openLaunch} />}
      {launch && <LaunchSheet initialTask={launch.task} onClose={() => setLaunch(null)} sendCommand={sendCommand} />}
    </div>
  );
}
