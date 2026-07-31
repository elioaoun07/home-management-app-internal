// src/components/pm-live/board/TaskRow.tsx
// One checklist item.
//
// READ-ONLY by construction: there is no checkbox here and there never will
// be. `tick` is refused by the bridge itself (bridge.mjs REFUSED_TYPES), not
// merely hidden — a tap once silently flipped a real PM checkbox to done with
// no trace and no way back (DLV-23).
//
// Hard Rule 2: a single tap opens the detail sheet. Launching is an explicit
// second action, reached by swiping the row left (revealing Deliver) or from
// inside the detail sheet — never a tap on the row itself.
//
// `displayText()` (not `task.text`) is what renders here: `PmTask.text` still
// carries the ID chip and the `(severity - effort)` suffix (a stripping-order
// bug in scripts/pm/shared/text.mjs), and this row already renders both as
// their own affordances — the ID badge and the severity rail/effort letter.
// Rendering `task.text` directly printed each one twice on every row.
"use client";

import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { displayText } from "@/features/pm-live/derive";
import type { PmTask } from "@/features/pm-live/types";

const SEVERITY_RAIL: Record<string, string> = {
  blocker: "var(--pm-sev-blocker)",
  friction: "var(--pm-sev-friction)",
  annoyance: "var(--pm-sev-annoyance)",
  parked: "var(--pm-sev-parked)",
};

const REVEAL_WIDTH = 76;
const OPEN_THRESHOLD = 38;

export function TaskRow({
  task,
  onOpen,
  onLaunch,
}: {
  task: PmTask;
  onOpen: (task: PmTask) => void;
  onLaunch: (task: PmTask) => void;
}) {
  // A delivery session is keyed by the item's ID chip; an untagged line has
  // nothing to deliver.
  const deliverable = !!task.idChip && task.state !== "done";
  const [dragX, setDragX] = useState(0);
  const drag = useRef({ startX: 0, startDragX: 0, active: false, moved: false });

  function onPointerDown(e: React.PointerEvent) {
    if (!deliverable) return;
    drag.current = { startX: e.clientX, startDragX: dragX, active: true, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    const delta = e.clientX - drag.current.startX;
    if (Math.abs(delta) > 4) drag.current.moved = true;
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, drag.current.startDragX + delta));
    setDragX(next);
  }
  function onPointerUp() {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragX(dragX <= -OPEN_THRESHOLD ? -REVEAL_WIDTH : 0);
  }

  function handleOpen() {
    if (drag.current.moved) return; // a swipe shouldn't also open the detail sheet
    if (dragX !== 0) {
      setDragX(0);
      return;
    }
    onOpen(task);
  }

  return (
    <div className="relative overflow-hidden border-t" style={{ borderColor: "var(--pm-border)" }}>
      {deliverable && (
        <button
          onClick={() => {
            setDragX(0);
            onLaunch(task);
          }}
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center text-[13px] font-semibold"
          style={{ width: REVEAL_WIDTH, backgroundColor: "var(--pm-accent)", color: "var(--pm-accent-ink)" }}
        >
          Deliver
        </button>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${dragX}px)`, transition: drag.current.active ? "none" : "transform 0.2s ease-out" }}
        className="relative flex items-stretch"
      >
        <span className="w-[3px] shrink-0" style={{ backgroundColor: task.severity ? SEVERITY_RAIL[task.severity] : "transparent" }} aria-hidden />
        <button onClick={handleOpen} className="flex-1 min-w-0 flex items-start gap-2.5 pl-3 pr-2 py-3 text-left" style={{ backgroundColor: "var(--pm-bg)" }}>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {task.idChip && (
                <span
                  className="text-[12px] font-mono font-medium px-1.5 py-0.5 rounded"
                  style={{ color: "var(--pm-fg-2)", backgroundColor: "var(--pm-surface)" }}
                >
                  {task.idChip}
                </span>
              )}
              {task.effort && (
                <span className="text-[12px] font-semibold" style={{ color: "var(--pm-fg-3)" }}>
                  {task.effort}
                </span>
              )}
              {task.state === "done" && (
                <span className="text-[12px] uppercase tracking-wide" style={{ color: "var(--pm-fg-3)" }}>
                  done
                </span>
              )}
            </span>
            <span className="block text-[15px] leading-snug line-clamp-2" style={{ color: "var(--pm-fg-1)" }}>
              {displayText(task)}
            </span>
          </span>
          <ChevronRight size={15} className="mt-1 shrink-0" style={{ color: "var(--pm-fg-3)" }} />
        </button>
      </div>
    </div>
  );
}
