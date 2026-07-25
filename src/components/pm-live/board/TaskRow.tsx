// src/components/pm-live/board/TaskRow.tsx
// One checklist item.
//
// READ-ONLY by construction: there is no checkbox here and there never will
// be. `tick` is refused by the bridge itself (bridge.mjs REFUSED_TYPES), not
// merely hidden — a tap once silently flipped a real PM checkbox to done with
// no trace and no way back (DLV-23).
//
// Hard Rule 2: a single tap opens the detail sheet. Launching is an explicit
// second action from inside that sheet, or the Deliver shortcut on the row.
"use client";

import { SEVERITY_DOT } from "@/features/pm-live/chartTheme";
import type { PmTask } from "@/features/pm-live/types";

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

  return (
    <div className="flex items-stretch border-t" style={{ borderColor: "var(--pm-border)" }}>
      <button onClick={() => onOpen(task)} className="flex-1 min-w-0 flex items-start gap-2.5 px-3.5 py-2.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 flex-wrap">
            {task.idChip && (
              <span className="text-[11px] font-mono" style={{ color: "var(--pm-fg-3)" }}>
                {task.idChip}
              </span>
            )}
            {task.severity && (
              <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[task.severity]}`} title={task.severity} aria-hidden />
            )}
            {task.severity && <span className="sr-only">{task.severity}</span>}
            {task.effort && (
              <span className="text-[10px]" style={{ color: "var(--pm-fg-3)" }}>
                {task.effort}
              </span>
            )}
            {task.state === "done" && (
              <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--pm-fg-3)" }}>
                done
              </span>
            )}
          </span>
          <span className="block text-[13.5px] leading-snug" style={{ color: "var(--pm-fg-1)" }}>
            {task.text}
          </span>
        </span>
      </button>

      {deliverable && (
        <button
          onClick={() => onLaunch(task)}
          className="shrink-0 self-center mr-3 ml-1 text-[11px] font-medium rounded-full px-2.5 py-1"
          style={{ color: "var(--pm-accent)", border: "1px solid var(--pm-accent-border)" }}
        >
          Deliver
        </button>
      )}
    </div>
  );
}
