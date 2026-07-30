import { describe, expect, it } from "vitest";
import {
  boardHash,
  groupTasks,
  isFilterActive,
  readBoardState,
  sortTasks,
  toggleFilterToken,
} from "../../scripts/pm/src/features/tasks/boardState.js";

const task = (over: Record<string, unknown> = {}) => ({
  module: "Budget", section: "Now", severity: "friction", effort: "M", text: "a task", file: "Budget/4 - Checklist.md", cbidx: 0, ...over,
});

describe("quick-filter tokens", () => {
  it("adds a filter, then toggles the same value off", () => {
    const once = toggleFilterToken("", "s", "blocker");
    expect(once).toBe("s:blocker");
    expect(toggleFilterToken(once, "s", "blocker")).toBe("");
  });

  it("replaces a different value for the same key — these filters are single-valued", () => {
    expect(toggleFilterToken("s:blocker", "s", "friction")).toBe("s:friction");
  });

  it("leaves free text and other filters untouched", () => {
    const out = toggleFilterToken("cache m:Budget s:blocker", "lane", "Now");
    expect(out).toContain("cache");
    expect(out).toContain("m:Budget");
    expect(out).toContain("lane:Now");
  });

  it("reports the active state the chips render from", () => {
    expect(isFilterActive("lane:Now", "lane", "now")).toBe(true);
    expect(isFilterActive("lane:Next", "lane", "Now")).toBe(false);
    expect(isFilterActive("effort:S", "e", "S")).toBe(true);
  });
});

describe("board URL state", () => {
  it("falls back to the defaults for missing or bogus params", () => {
    expect(readBoardState(new URLSearchParams(""))).toEqual({ query: "", groupBy: "lane", sortBy: "lane" });
    expect(readBoardState(new URLSearchParams("group=nonsense&sort=nonsense"))).toEqual({ query: "", groupBy: "lane", sortBy: "lane" });
  });

  it("round-trips a real state through the hash", () => {
    const state = { query: "s:blocker", groupBy: "severity", sortBy: "effort" };
    const hash = boardHash("/tasks", state);
    expect(hash).toBe("#/tasks?q=s%3Ablocker&group=severity&sort=effort");
    expect(readBoardState(new URLSearchParams(hash.split("?")[1]))).toEqual(state);
  });

  it("omits defaults so a clean board has a clean URL", () => {
    expect(boardHash("/tasks", { query: "", groupBy: "lane", sortBy: "lane" })).toBe("#/tasks");
  });
});

describe("sorting", () => {
  it("orders by lane, then severity", () => {
    const out = sortTasks([
      task({ section: "Later", severity: "blocker", text: "c" }),
      task({ section: "Now", severity: "annoyance", text: "b" }),
      task({ section: "Now", severity: "blocker", text: "a" }),
    ], "lane");
    expect(out.map((t) => t.text)).toEqual(["a", "b", "c"]);
  });

  it("orders by severity across lanes when asked", () => {
    const out = sortTasks([
      task({ section: "Now", severity: "parked", text: "b" }),
      task({ section: "Later", severity: "blocker", text: "a" }),
    ], "severity");
    expect(out.map((t) => t.text)).toEqual(["a", "b"]);
  });

  it("puts unsized and unrated items last rather than first", () => {
    const out = sortTasks([task({ effort: null, text: "b" }), task({ effort: "S", text: "a" })], "effort");
    expect(out.map((t) => t.text)).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const input = [task({ text: "b", section: "Later" }), task({ text: "a", section: "Now" })];
    sortTasks(input, "lane");
    expect(input.map((t) => t.text)).toEqual(["b", "a"]);
  });
});

describe("grouping", () => {
  it("always emits all three lanes — an empty Now lane is information", () => {
    const groups = groupTasks([task({ section: "Later" })], "lane");
    expect(groups.map((g) => g.label)).toEqual(["Now", "Next", "Later"]);
    expect(groups[0].items).toEqual([]);
  });

  it("adds an Other lane only when something falls outside the three", () => {
    expect(groupTasks([task({ section: "Definition of Done" })], "lane").map((g) => g.label))
      .toEqual(["Now", "Next", "Later", "Other"]);
  });

  it("groups by severity in severity order, not alphabetically", () => {
    const groups = groupTasks([task({ severity: "parked" }), task({ severity: "blocker" }), task({ severity: "annoyance" })], "severity");
    expect(groups.map((g) => g.label)).toEqual(["blocker", "annoyance", "parked"]);
  });

  it("labels missing severity and effort rather than dropping those tasks", () => {
    expect(groupTasks([task({ severity: null })], "severity").map((g) => g.label)).toEqual(["unrated"]);
    expect(groupTasks([task({ effort: null })], "effort").map((g) => g.label)).toEqual(["unsized"]);
  });

  it("collapses to a single group when grouping is off", () => {
    const groups = groupTasks([task(), task({ section: "Later" })], "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});
