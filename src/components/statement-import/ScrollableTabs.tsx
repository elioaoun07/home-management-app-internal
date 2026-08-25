"use client";

// A pill tab bar that scrolls horizontally instead of truncating.
//
// The statement review has six top-level tabs and each one carries a count that
// IS the information ("Skipped 85"). Squeezing them into equal `flex-1` slots
// with `truncate` cut the counts off — the one part that must stay readable.
// So: each tab keeps its natural width, the row scrolls, and the edges fade to
// show there is more.
//
// The fade is a CSS mask, not a gradient overlay, deliberately: `tc.pillBg` is
// a translucent per-theme colour, so an overlay would need to know the colour
// underneath it in all four themes. A mask fades the content itself and is
// background-agnostic. It is applied only on a side that can actually scroll,
// so a bar that fits shows no fade at all.

import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

export type TabSpec<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

/** Width of the fade at each scrollable edge. */
const FADE_PX = 24;

/**
 * Which edges still have content beyond them. Pure so the fade logic is
 * testable without a layout engine — the DOM measurements are the only input.
 */
export function scrollEdges(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): { start: boolean; end: boolean } {
  // 1px of slack: fractional scroll positions never land exactly on the max,
  // and a bar that fits reports scrollWidth === clientWidth (both edges "at").
  return {
    start: scrollLeft <= 1,
    end: scrollLeft >= scrollWidth - clientWidth - 1,
  };
}

/** The CSS mask that fades only the edges you can still scroll toward. */
export function edgeMask(edges: { start: boolean; end: boolean }): string {
  return `linear-gradient(to right, ${
    edges.start ? "black" : "transparent"
  } 0, black ${FADE_PX}px, black calc(100% - ${FADE_PX}px), ${
    edges.end ? "black" : "transparent"
  } 100%)`;
}

export function ScrollableTabs<T extends string>({
  tabs,
  value,
  onChange,
  size = "md",
}: {
  tabs: Array<TabSpec<T>>;
  value: T;
  onChange: (next: T) => void;
  size?: "sm" | "md";
}) {
  const tc = useThemeClasses();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = scrollEdges(el.scrollLeft, el.scrollWidth, el.clientWidth);
    setEdges((prev) =>
      prev.start === next.start && prev.end === next.end ? prev : next,
    );
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;

    // A NATIVE scroll listener, not React's `onScroll`: `scroll` does not
    // bubble, so it is one of the few events React does not delegate the same
    // way as the rest, and `passive: true` keeps touch scrolling smooth on a
    // phone — which is where this bar is actually dragged.
    el.addEventListener("scroll", measure, { passive: true });

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(el);

    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [measure, tabs.length]);

  // Keep the selected tab on screen — selecting one off-screen (or landing on
  // a tab the page chose for you) must not leave it scrolled out of sight.
  useEffect(() => {
    const el = scrollRef.current;
    const active = el?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [value]);

  const mask = edgeMask(edges);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex gap-1 p-1 rounded-xl overflow-x-auto [&::-webkit-scrollbar]:hidden",
        tc.pillBg,
      )}
      style={{
        scrollbarWidth: "none",
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          data-tab={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-lg font-medium shrink-0 whitespace-nowrap",
            size === "sm" ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-[11px]",
            value === tab.value ? tc.buttonPrimary : tc.textMuted,
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1 tabular-nums">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
