// src/components/pm-live/session/SegmentedPanes.tsx
// The session-detail navigator: a sticky segmented pill bar with a sliding
// thumb over horizontally snap-scrolling panes.
//
// Native CSS scroll-snap does the paging, so the swipe has real momentum and
// costs no re-renders while the finger is down — the scroll handler only runs
// on rAF and only writes when the resting page actually changed. Tapping a
// segment scrolls the same container, so the two inputs can never disagree.
"use client";

import { useCallback, useEffect, useRef } from "react";

export interface PaneSpec<K extends string> {
  key: K;
  label: string;
  icon: React.ReactNode;
  /** Small count/amount shown on the segment — omit rather than render a zero. */
  badge?: string | number | null;
  content: React.ReactNode;
}

export function SegmentedPanes<K extends string>({
  panes,
  active,
  onChange,
}: {
  panes: PaneSpec<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, panes.findIndex((pane) => pane.key === active));
  // Guards the feedback loop: a programmatic scrollTo must not be read back as
  // a user swipe and re-dispatched.
  const scrollingTo = useRef(false);
  const frame = useRef(0);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    scrollingTo.current = true;
    track.scrollTo({ left: index * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => { scrollingTo.current = false; }, smooth ? 400 : 0);
  }, []);

  // Keep the track in step when the pane changes from outside (a deep link, or
  // a jump from another pane's action).
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const track = trackRef.current;
    if (!track) return;
    if (Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) !== activeIndex) scrollToIndex(activeIndex, !reduced);
  }, [activeIndex, scrollToIndex]);

  function onScroll() {
    if (scrollingTo.current) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      if (!track) return;
      const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      const pane = panes[index];
      if (pane && pane.key !== active) onChange(pane.key);
    });
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div
        className="sticky top-0 z-10 px-3 lg:px-5 pt-2.5 pb-2 border-b"
        style={{ backgroundColor: "var(--pm-bg)", borderColor: "var(--pm-border)" }}
      >
        <div
          className="relative grid rounded-xl p-1"
          style={{ gridTemplateColumns: `repeat(${panes.length}, minmax(0, 1fr))`, backgroundColor: "var(--pm-surface)" }}
          role="tablist"
        >
          <span
            aria-hidden
            className="absolute inset-y-1 rounded-lg motion-safe:transition-transform motion-safe:duration-200"
            style={{
              width: `calc((100% - 0.5rem) / ${panes.length})`,
              left: "0.25rem",
              transform: `translateX(calc(${activeIndex} * 100%))`,
              backgroundColor: "var(--pm-surface-strong)",
            }}
          />
          {panes.map((pane) => {
            const selected = pane.key === active;
            return (
              <button
                key={pane.key}
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(pane.key)}
                className="relative z-[1] flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium"
                style={{ color: selected ? "var(--pm-fg-1)" : "var(--pm-fg-3)" }}
              >
                {pane.icon}
                <span className="hidden min-[420px]:inline">{pane.label}</span>
                {pane.badge != null && pane.badge !== "" && (
                  <span className="text-[10.5px] tabular-nums px-1 rounded" style={{ backgroundColor: "var(--pm-bg)", color: "var(--pm-fg-2)" }}>
                    {pane.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory pm-scroll-x"
        style={{ overscrollBehaviorX: "contain" }}
      >
        {panes.map((pane) => (
          <section
            key={pane.key}
            role="tabpanel"
            aria-label={pane.label}
            className="w-full shrink-0 snap-center overflow-y-auto px-3 lg:px-5 py-3"
          >
            {pane.content}
          </section>
        ))}
      </div>
    </div>
  );
}
