import { describe, expect, it } from "vitest";
import { checklistAnchors } from "../../scripts/pm/shared/work-id.mjs";
import { kindOf } from "../../scripts/pm/src/lib/portfolio.js";
import {
  activityBadges,
  boardQueryString,
  briefPath,
  buildWorld,
  checklistPath,
  laneGroups,
  laneOf,
  matchesBoardFilters,
  parseBoardQuery,
} from "../../scripts/pm/app/model";
import type { Snapshot } from "../../scripts/pm/app/types";

const CHECKLIST = [
  "## Now",
  "- [ ] **BUD-1** First outcome — [criteria](<Budget — Master Book.md#bud-1>) _(blocker - S)_",
  "- [ ] **BUD-2** Second outcome, HELD on BUD-1 _(friction - M)_",
  "## Next",
  "- [ ] **BUD-3** Third outcome _(annoyance - S)_",
  "## Later",
  "- [ ] **BUD-4** No book section _(parked - L)_",
  "",
].join("\n");
const BOOK = [
  "## Acceptance Criteria Index",
  "### BUD-1",
  "**Outcome:** First outcome.",
  "**Kind:** bug",
  "### BUD-2",
  "**Outcome:** Second outcome.",
  "### BUD-3",
  "**Outcome:** Third outcome.",
  "",
].join("\n");
const snapshot: Snapshot = {
  generatedAt: "2026-09-11T12:00:00Z",
  files: [
    { relPath: "Budget/4 - Checklist.md", raw: CHECKLIST },
    { relPath: "Budget/Budget — Master Book.md", raw: BOOK },
  ],
};

describe("checklist anchors", () => {
  it("keys every checkbox chip by its own line, matching the brief slug", () => {
    const anchors = checklistAnchors(CHECKLIST);
    expect(anchors.map((entry) => entry.id)).toEqual([
      "BUD-1",
      "BUD-2",
      "BUD-3",
      "BUD-4",
    ]);
    expect(anchors.find((entry) => entry.id === "BUD-1")?.anchor).toBe("bud-1");
  });
});

describe("declared kind, never guessed", () => {
  it("reads an explicit Kind line and defaults to unclassified otherwise", () => {
    expect(kindOf("**Outcome:** X.\n**Kind:** bug\n")).toBe("bug");
    expect(kindOf("**Outcome:** X.\n")).toBe("unclassified");
    expect(kindOf("**Kind:** not-a-real-kind\n")).toBe("unclassified");
  });
});

describe("Board/List model", () => {
  const world = buildWorld(snapshot);
  const work = (id: string) => world.work.find((item) => item.id === id)!;

  it("opens the checklist row directly, distinct from the acceptance heading", () => {
    const bud1 = checklistPath(work("BUD-1"), "/explore");
    const query = new URLSearchParams(bud1.split("?")[1]);
    expect(query.get("file")).toBe("Budget/4 - Checklist.md");
    expect(query.get("anchor")).toBe("bud-1");
    const brief = briefPath(work("BUD-1"), world, "/explore");
    expect(brief).not.toBe(bud1);
    expect(new URLSearchParams(brief.split("?")[1]).get("file")).toBe(
      "Budget/Budget — Master Book.md",
    );
  });
  it("falls back to the checklist row itself when there is no book section", () => {
    const path = checklistPath(work("BUD-4"), "/explore");
    expect(briefPath(work("BUD-4"), world, "/explore")).toBe(path);
  });
  it("keeps blocked/active/review as badges without moving the persisted lane", () => {
    expect(laneOf(work("BUD-1"))).toBe("Now");
    expect(activityBadges(work("BUD-2"), [])).toEqual(["blocked"]);
    const run = {
      sessionId: "s",
      state: "BUILDING",
      item: { id: "BUD-1", campaign: "Budget" },
      agent: "claude",
    };
    expect(activityBadges(work("BUD-1"), [run])).toEqual(["active"]);
    expect(activityBadges(work("BUD-3"), [])).toEqual([]);
    const groups = laneGroups(world.work);
    expect(groups.Now.map((item) => item.id)).toEqual(["BUD-1", "BUD-2"]);
    expect(groups.Next.map((item) => item.id)).toEqual(["BUD-3"]);
    expect(groups.Later.map((item) => item.id)).toEqual(["BUD-4"]);
  });
  it("round-trips filters through a shareable URL", () => {
    const filters = parseBoardQuery(
      new URLSearchParams("view=list&status=blocked&campaigns=Budget,Schedule&kind=bug&lane=Next"),
    );
    expect(filters).toEqual({
      view: "list",
      status: "blocked",
      campaigns: ["Budget", "Schedule"],
      kind: "bug",
      lane: "Next",
    });
    expect(boardQueryString(filters)).toBe(
      "?view=list&status=blocked&campaigns=Budget%2CSchedule&kind=bug&lane=Next",
    );
    expect(parseBoardQuery(new URLSearchParams())).toEqual({
      view: "board",
      status: "open",
      campaigns: [],
      kind: null,
      lane: "Now",
    });
    // `view` always round-trips, even at its default — an absent `view` is
    // what tells the Work page to render Search instead of Board.
    expect(boardQueryString(parseBoardQuery(new URLSearchParams()))).toBe(
      "?view=board",
    );
  });
  it("filters by campaign, kind and status without relocating priority", () => {
    const empty: { campaigns: string[]; kind: string | null } = {
      campaigns: [],
      kind: null,
    };
    expect(matchesBoardFilters(work("BUD-2"), [], { ...empty, status: "open" })).toBe(true);
    expect(matchesBoardFilters(work("BUD-2"), [], { ...empty, status: "blocked" })).toBe(true);
    expect(matchesBoardFilters(work("BUD-1"), [], { ...empty, status: "blocked" })).toBe(false);
    expect(matchesBoardFilters(work("BUD-1"), [], { campaigns: ["Schedule"], kind: null, status: "open" })).toBe(false);
    expect(matchesBoardFilters(work("BUD-1"), [], { campaigns: [], kind: "bug", status: "open" })).toBe(true);
    expect(matchesBoardFilters(work("BUD-3"), [], { campaigns: [], kind: "bug", status: "open" })).toBe(false);
  });
});
