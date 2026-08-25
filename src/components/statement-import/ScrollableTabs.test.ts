import { describe, expect, it } from "vitest";
import { edgeMask, scrollEdges } from "./ScrollableTabs";

// The tab bar carries the counts the owner reads ("Skipped 85"), so it scrolls
// instead of truncating. The fade tells them there is more — and must appear
// ONLY on a side that can actually be scrolled toward, or it reads as a bug.
describe("scrollEdges", () => {
  // A bar that fits is at BOTH ends at once, so neither side fades — the
  // affordance must not appear when there is nothing to scroll toward.
  it("fades neither edge when the bar fits", () => {
    const edges = scrollEdges(0, 640, 640);
    expect(edges).toEqual({ start: true, end: true });
    expect(edgeMask(edges)).toBe(
      "linear-gradient(to right, black 0, black 24px, black calc(100% - 24px), black 100%)",
    );
  });

  it("fades only the right edge at the start of a scrollable bar", () => {
    const edges = scrollEdges(0, 516, 328);
    expect(edges).toEqual({ start: true, end: false });
    expect(edgeMask(edges)).toBe(
      "linear-gradient(to right, black 0, black 24px, black calc(100% - 24px), transparent 100%)",
    );
  });

  it("fades only the left edge at the far end", () => {
    const edges = scrollEdges(188, 516, 328);
    expect(edges).toEqual({ start: false, end: true });
    expect(edgeMask(edges)).toBe(
      "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), black 100%)",
    );
  });

  it("fades both edges mid-scroll", () => {
    const edges = scrollEdges(94, 516, 328);
    expect(edges).toEqual({ start: false, end: false });
    expect(edgeMask(edges)).toBe(
      "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
    );
  });

  // Fractional scroll offsets never land exactly on 0 or the max, so both
  // ends need slack or the fade flickers on at the very edge.
  it("tolerates sub-pixel scroll offsets at both ends", () => {
    expect(scrollEdges(0.5, 516, 328).start).toBe(true);
    expect(scrollEdges(187.4, 516, 328).end).toBe(true);
  });
});
