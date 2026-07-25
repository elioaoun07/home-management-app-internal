// src/components/pm-live/views/BoardView.tsx
// The working queue. Groups are flattened into one row list so the whole thing
// can be virtualized as a single window — grouping headers included — which is
// what keeps ~480 rows scrolling smoothly on a phone.
"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BoardToolbar } from "../board/BoardToolbar";
import { TaskRow } from "../board/TaskRow";
import { useFilteredTasks, useGroupedTasks, pmTaskKey } from "@/features/pm-live/selectors";
import { useTasks } from "@/features/pm-live/store";
import { useViewState } from "@/features/pm-live/viewState";
import type { PmTask } from "@/features/pm-live/types";

type Row = { kind: "header"; key: string; label: string; count: number } | { kind: "task"; key: string; task: PmTask };

const HEADER_HEIGHT = 34;
const TASK_HEIGHT = 62;

export function BoardView({
  scrollRef,
  onOpenTask,
  onLaunch,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  onOpenTask: (task: PmTask) => void;
  onLaunch: (task: PmTask) => void;
}) {
  const groups = useGroupedTasks();
  const filtered = useFilteredTasks();
  const snapshot = useTasks();
  const groupBy = useViewState((s) => s.groupBy);
  const listRef = useRef<HTMLDivElement>(null);

  const totalOpen = useMemo(() => (snapshot?.tasks || []).filter((t) => t.state !== "done").length, [snapshot]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const group of groups) {
      // A single "All" bucket has nothing to announce.
      if (groupBy !== "none") out.push({ kind: "header", key: `h:${group.key}`, label: group.key, count: group.tasks.length });
      for (const task of group.tasks) out.push({ kind: "task", key: pmTaskKey(task), task });
    }
    return out;
  }, [groups, groupBy]);

  // How far the list sits below the top of the scroll container (the sticky
  // toolbar's height). Measured in a layout effect rather than read off the ref
  // during render — on first paint the ref is still null, and a 0 here shifts
  // every row up behind the toolbar.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setScrollMargin(listRef.current?.offsetTop ?? 0);
    measure();
    const observer = new ResizeObserver(measure);
    if (listRef.current?.parentElement) observer.observe(listRef.current.parentElement);
    return () => observer.disconnect();
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index].kind === "header" ? HEADER_HEIGHT : TASK_HEIGHT),
    overscan: 8,
    // Rows are measured after mount, so a wrapped two-line item doesn't overlap
    // the next one.
    measureElement: (el) => el.getBoundingClientRect().height,
    scrollMargin,
  });

  if (!snapshot) {
    return (
      <div className="p-4 text-[13px]" style={{ color: "var(--pm-fg-3)" }}>
        Waiting for the laptop to publish checklist data…
      </div>
    );
  }

  return (
    <>
      <BoardToolbar shown={filtered.length} total={totalOpen} />

      <div className="px-3 lg:px-5 pb-24 lg:pb-8">
        {!rows.length ? (
          <p className="py-10 text-center text-[13px]" style={{ color: "var(--pm-fg-3)" }}>
            Nothing matches. Clear the filters to see the whole board.
          </p>
        ) : (
          <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {row.kind === "header" ? (
                    <h2
                      className="flex items-baseline gap-2 pt-4 pb-1.5 text-[12px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--pm-fg-2)" }}
                    >
                      <span className="truncate">{row.label}</span>
                      <span className="tabular-nums font-normal" style={{ color: "var(--pm-fg-3)" }}>
                        {row.count}
                      </span>
                    </h2>
                  ) : (
                    <TaskRow task={row.task} onOpen={onOpenTask} onLaunch={onLaunch} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
