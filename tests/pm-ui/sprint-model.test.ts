import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  dateInTimezone,
  forecastSprints,
  mondayOf,
  sprintDateLabel,
  sprintItemStatus,
  sprintRef,
} from "../../scripts/pm/app/sprintModel";
import type { SprintReadinessMap } from "../../scripts/pm/app/sprintModel";
import type {
  Receipt,
  RunSummary,
  V2RunSummary,
  Work,
  World,
} from "../../scripts/pm/app/types";

function item(id: string, module = "Budget", extra: Partial<Work> = {}): Work {
  return {
    id,
    idChip: id,
    label: id,
    briefAnchor: id.toLowerCase(),
    key: `${module}:${id}`,
    title: `Deliver ${id}`,
    text: `Deliver ${id}`,
    module,
    file: `${module}/4 - Checklist.md`,
    cbidx: 0,
    line: Number(id.match(/\d+/)?.[0] || 0),
    rawLine: `- [ ] **${id}** Deliver ${id} _(friction - M)_`,
    section: "Now",
    state: "open",
    effort: "M",
    severity: "friction",
    outcome: "Deliver a bounded change",
    contract:
      "**Outcome:** Deliver a bounded change.\n**Acceptance:** The changed behavior is verified.",
    kind: "feature",
    blocked: false,
    dependencies: [],
    dependentIds: [],
    relatedIds: [],
    decisionIds: [],
    topicIds: [],
    topicEvidence: [],
    ...extra,
  };
}
function world(work: Work[], history: Receipt[] = []): World {
  return {
    spaces: [...new Set(work.map((entry) => entry.module))].map((name) => ({
      name,
      purpose: name,
      book: undefined,
      work: work.filter((entry) => entry.module === name),
      history: [],
    })),
    work,
    choices: [],
    history,
    files: [],
    generatedAt: "2026-10-03T12:00:00.000Z",
    offline: false,
  };
}
function receipt(
  id: string,
  status = "Shipped",
  date = "2026-10-01",
  extra: Partial<Receipt> = {},
): Receipt {
  return {
    key: `${id}:${status}:${date}`,
    date,
    dateEnd: null,
    datePrecision: "day",
    dateNote: null,
    id,
    workId: id.toUpperCase(),
    ids: [id.toUpperCase()],
    identity: "exact",
    text: "Recorded outcome",
    raw: "",
    campaign: "Budget",
    file: "Budget/Budget — Master Book.md",
    line: 0,
    status,
    ...extra,
  };
}
function v2(extra: Partial<V2RunSummary> = {}): V2RunSummary {
  return {
    run_id: "v2-one",
    engine: "v2",
    title: "Work",
    alias: "BUD-1",
    file: "Budget/4 - Checklist.md",
    campaign: "Budget",
    lifecycle: "ACTIVE",
    closed_outcome: null,
    waiting_reason: null,
    executor: "codex",
    model: "model",
    effort: "medium",
    stage: "build",
    branch: null,
    active: true,
    ownerAction: "Working",
    ownerActionKind: "none",
    created_at: "2026-10-03T10:00:00Z",
    updated_at: "2026-10-03T11:00:00Z",
    ...extra,
  };
}
function v1(extra: Partial<RunSummary> = {}): RunSummary {
  return {
    sessionId: "v1-one",
    item: { id: "BUD-1", campaign: "Budget" },
    state: "BUILDING",
    agent: "codex",
    updatedAt: "2026-10-03T11:00:00Z",
    ...extra,
  };
}
const baseOptions = {
  strategy: "balanced" as const,
  start: "2026-10-05",
  timezone: "Asia/Beirut",
  capacity: 6,
  weeks: 8,
};

describe("weekly calendar dates", () => {
  it("uses Monday through Sunday without browser-zone date shifts", () => {
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(addCalendarDays("2026-10-19", 7)).toBe("2026-10-26");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(sprintDateLabel("2026-10-05", { weekday: "long" })).toBe("Monday");
  });
  it("chooses the current local calendar day using the named IANA zone", () => {
    expect(dateInTimezone("2026-10-04T22:30:00Z", "Asia/Beirut")).toBe(
      "2026-10-05",
    );
    expect(dateInTimezone("2026-10-04T22:30:00Z", "America/Los_Angeles")).toBe(
      "2026-10-04",
    );
    expect(() => mondayOf("2026-02-30")).toThrow("Invalid calendar date");
    expect(() => dateInTimezone("not-a-date", "Asia/Beirut")).toThrow(
      "Invalid instant",
    );
  });
});

describe("sprint work status", () => {
  it("observes CLI completion before and after archive without counting receipts twice", () => {
    const work = item("BUD-1");
    expect(
      sprintItemStatus(sprintRef(work), world([{ ...work, state: "done" }]))
        .state,
    ).toBe("done");
    expect(
      sprintItemStatus(
        sprintRef(work),
        world(
          [],
          [receipt("BUD-1"), receipt("BUD-1", "Shipped", "2026-09-20")],
        ),
      ).state,
    ).toBe("done");
    expect(
      sprintItemStatus(sprintRef(work), world([work], [receipt("BUD-1")]))
        .state,
    ).toBe("todo");
  });
  it("distinguishes cancellation, missing work, referenced receipts, and duplicate IDs", () => {
    const work = item("BUD-1");
    expect(
      sprintItemStatus(
        sprintRef(work),
        world([], [receipt("BUD-1", "Cancelled")]),
      ).state,
    ).toBe("cancelled");
    expect(sprintItemStatus(sprintRef(work), world([])).state).toBe("missing");
    expect(
      sprintItemStatus(
        sprintRef(work),
        world(
          [],
          [
            receipt("BUD-1", "Shipped", "2026-10-01", {
              identity: "referenced",
              workId: null,
            }),
          ],
        ),
      ).state,
    ).toBe("missing");
    expect(
      sprintItemStatus(
        sprintRef(work),
        world([work, { ...work }], [receipt("BUD-1")]),
      ).state,
    ).toBe("missing");
  });
  it("matches exact campaign and full dotted/case-normalized IDs", () => {
    const work = item("BUD-4.3b");
    const ref = {
      workId: "bud-4.3B",
      origin: { alias: "BUD-4.3b", file: work.file },
    };
    expect(sprintItemStatus(ref, world([work])).work).toBe(work);
    expect(
      sprintItemStatus(
        ref,
        world(
          [],
          [
            receipt("BUD-4.3"),
            receipt("BUD-4.3B", "Shipped", "2026-10-01", {
              campaign: "Kitchen",
            }),
          ],
        ),
      ).state,
    ).toBe("missing");
  });
  it("uses the latest exact canonical outcome", () => {
    const ref = sprintRef(item("BUD-1"));
    expect(
      sprintItemStatus(
        ref,
        world(
          [],
          [receipt("BUD-1"), receipt("BUD-1", "Cancelled", "2026-10-02")],
        ),
      ).state,
    ).toBe("cancelled");
    expect(
      sprintItemStatus(
        ref,
        world(
          [],
          [receipt("BUD-1", "Cancelled", "2026-09-25"), receipt("BUD-1")],
        ),
      ).state,
    ).toBe("done");
  });
  it("shows V1 and V2 active/review facts with the existing run routes", () => {
    const work = item("BUD-1");
    const data = world([work]);
    const ref = sprintRef(work);
    expect(sprintItemStatus(ref, data, { v1: [v1()] })).toMatchObject({
      state: "active",
      label: "Building",
      run: { path: "/delivery/session/v1-one?from=%2Fsprints" },
    });
    expect(
      sprintItemStatus(ref, data, {
        v1: [v1({ state: "PLAN_READY", awaiting: { gate: "plan" } })],
      }),
    ).toMatchObject({ state: "review", label: "Review plan" });
    expect(sprintItemStatus(ref, data, { v2: [v2()] })).toMatchObject({
      state: "active",
      run: { path: "/delivery/run/v2-one?from=%2Fsprints" },
    });
    expect(
      sprintItemStatus(ref, data, {
        v2: [
          v2({
            active: false,
            lifecycle: "WAITING",
            ownerAction: "Review plan",
            ownerActionKind: "review-plan",
          }),
        ],
      }),
    ).toMatchObject({ state: "review", label: "Review plan" });
    expect(
      sprintItemStatus(ref, data, {
        v2: [
          v2({
            active: false,
            lifecycle: "WAITING",
            ownerAction: "Waiting",
            ownerActionKind: "waiting",
          }),
        ],
      }).state,
    ).toBe("blocked");
  });
  it("never completes canonical work because a delivery failed, cancelled, shipped or applied", () => {
    const work = item("BUD-1");
    const data = world([work]);
    const ref = sprintRef(work);
    for (const state of ["FAILED", "CANCELLED", "SHIPPED"])
      expect(sprintItemStatus(ref, data, { v1: [v1({ state })] }).state).toBe(
        "todo",
      );
    for (const closed_outcome of ["failed", "cancelled"])
      expect(
        sprintItemStatus(ref, data, {
          v2: [v2({ lifecycle: "CLOSED", closed_outcome, active: false })],
        }).state,
      ).toBe("todo");
    expect(
      sprintItemStatus(ref, data, {
        v2: [
          v2({
            lifecycle: "CLOSED",
            closed_outcome: "verified_candidate",
            active: false,
            ownerAction: "Apply",
            ownerActionKind: "apply",
          }),
        ],
      }),
    ).toMatchObject({ state: "review", label: "Apply" });
    expect(
      sprintItemStatus(ref, data, {
        v2: [
          v2({
            lifecycle: "CLOSED",
            closed_outcome: "verified_candidate",
            active: false,
            application: { application_id: "application", state: "applied" },
          }),
        ],
      }),
    ).toMatchObject({ state: "review", label: "Completion pending" });
  });
  it("keeps unknown execution visible without pretending the stopped worker failed", () => {
    const work = item("BUD-1");
    expect(
      sprintItemStatus(sprintRef(work), world([work]), {
        v2: [
          v2({
            active: false,
            lifecycle: "WAITING",
            branch: "unknown",
            ownerAction: "Reconcile",
            ownerActionKind: "reconcile",
          }),
        ],
      }),
    ).toMatchObject({
      state: "review",
      label: "Outcome unknown",
      ready: false,
    });
  });
  it("projects dependencies, owner gates and criteria changes without granting dispatch", () => {
    const work = item("BUD-1", "Budget", {
      dependencies: [{ id: "BUD-2", status: "Owner UAT" }],
    });
    expect(sprintItemStatus(sprintRef(work), world([work]))).toMatchObject({
      state: "blocked",
      ready: false,
      reasons: ["Owner check · BUD-2"],
    });
    const readiness: SprintReadinessMap = {
      "BUD-1": {
        status: "open",
        state: "ready",
        criteriaRevision: "new",
        effort: "M",
        reasons: [],
      },
    };
    const plain = item("BUD-1");
    expect(
      sprintItemStatus(sprintRef(plain), world([plain]), {
        readiness,
        criteriaRevision: "old",
      }),
    ).toMatchObject({
      state: "needs-input",
      ready: false,
      reasons: ["Criteria changed"],
    });
  });
});

describe("weekly forecast", () => {
  it("offers both strategies over the same canonical refs, never exceeding capacity or module limits", () => {
    const data = world([
      item("BUD-1"),
      item("BUD-2"),
      item("BUD-3"),
      item("SCH-1", "Schedule"),
      item("SCH-2", "Schedule"),
      item("KIT-1", "Kitchen"),
    ]);
    const balanced = forecastSprints(data, baseOptions);
    expect(balanced.weeks[0].modules).toEqual(["Budget", "Schedule"]);
    expect(
      balanced.weeks
        .flatMap((week) => week.members)
        .map((member) => member.workId)
        .sort(),
    ).toEqual(data.work.map((work) => work.id).sort());
    const focused = forecastSprints(data, {
      ...baseOptions,
      strategy: "module",
    });
    for (const week of [...balanced.weeks, ...focused.weeks]) {
      expect(week.points).toBeLessThanOrEqual(6);
      expect(
        week.members.every((member) => member.reviewMinutes === null),
      ).toBe(true);
      expect(week.modules.length).toBeLessThanOrEqual(
        week.strategy === "module" ? 1 : 2,
      );
      expect(week.endExclusive).toBe(addCalendarDays(week.startDate, 7));
      expect(week.members[0]).not.toHaveProperty("title");
    }
  });
  it("prioritizes Now over Next and never auto-promotes Later", () => {
    const now = item("BUD-2");
    const next = item("BUD-1", "Budget", { section: "Next" });
    const later = item("BUD-3", "Budget", { section: "Later" });
    const forecast = forecastSprints(world([next, later, now]), {
      ...baseOptions,
      capacity: 2,
    });
    expect(
      forecast.weeks.map((week) => week.members.map((member) => member.workId)),
    ).toEqual([["BUD-2"], ["BUD-1"]]);
    expect(forecast.unplanned).toMatchObject([
      { ref: { workId: "BUD-3" }, reason: "Later priority" },
    ]);
  });
  it("forecasts prerequisites in earlier weeks but does not unblock them for launch", () => {
    const prerequisite = item("BUD-1", "Budget", { section: "Next" });
    const dependent = item("BUD-2", "Budget", {
      dependencies: [{ id: "BUD-1", status: "Open" }],
      contract: "**Outcome:** Deliver.\n**Depends on:** BUD-1",
      blocked: true,
    });
    const data = world([dependent, prerequisite]);
    const forecast = forecastSprints(data, baseOptions);
    expect(
      forecast.weeks.map((week) => week.members.map((member) => member.workId)),
    ).toEqual([["BUD-1"], ["BUD-2"]]);
    expect(forecast.weeks[1].reasons).toEqual(["After BUD-1"]);
    expect(sprintItemStatus(sprintRef(dependent), data)).toMatchObject({
      state: "blocked",
      ready: false,
    });
  });
  it("discloses L, missing estimates, holds, decisions, unavailable prerequisites and exclusions", () => {
    const data = world([
      item("BUD-1", "Budget", { effort: "L" }),
      item("BUD-2", "Budget", { effort: null }),
      item("BUD-3", "Budget", { text: "HELD until owner returns" }),
      item("BUD-4", "Budget", { decisionIds: ["DEC-1"] }),
      item("BUD-5", "Budget", {
        dependencies: [{ id: "BUD-20", status: "Cancelled" }],
      }),
      item("BUD-6", "Budget", {
        dependencies: [{ id: "BUD-21", status: "Owner UAT" }],
      }),
      item("BUD-7"),
    ]);
    const forecast = forecastSprints(data, {
      ...baseOptions,
      exclude: [sprintRef(data.work[6])],
    });
    expect(forecast.weeks).toEqual([]);
    expect(forecast.unplanned.map((entry) => entry.reason)).toEqual([
      "Split first",
      "Add estimate",
      "Held",
      "Decision needed · DEC-1",
      "BUD-20 cancelled",
      "Owner check · BUD-21",
      "Already planned or excluded",
    ]);
  });
  it("detects dependency cycles rather than treating a selected group as ready", () => {
    const data = world([
      item("BUD-1", "Budget", {
        contract: "**Depends on:** BUD-2",
        dependencies: [{ id: "BUD-2", status: "Open" }],
      }),
      item("BUD-2", "Budget", {
        contract: "**Depends on:** BUD-1",
        dependencies: [{ id: "BUD-1", status: "Open" }],
      }),
      item("BUD-3", "Budget", {
        dependencies: [{ id: "BUD-1", status: "Open" }],
      }),
    ]);
    const forecast = forecastSprints(data, baseOptions);
    expect(forecast.weeks).toEqual([]);
    expect(forecast.unplanned.map((entry) => entry.reason)).toEqual([
      "Dependency cycle",
      "Dependency cycle",
      "After BUD-1",
    ]);
  });
  it("respects server readiness without mistaking a saved plan for evidence", () => {
    const work = item("BUD-1");
    const readiness: SprintReadinessMap = {
      "BUD-1": {
        status: "open",
        state: "needs-input",
        criteriaRevision: "revision",
        effort: "M",
        reasons: [{ code: "missing-acceptance" }],
      },
    };
    expect(
      forecastSprints(world([work]), { ...baseOptions, readiness }).unplanned[0]
        .reason,
    ).toBe("Add acceptance");
  });
  it("retains a server prerequisite refusal when the cached source projection is older", () => {
    const data = world([item("BUD-1"), item("BUD-2")]);
    const readiness: SprintReadinessMap = {
      "BUD-1": {
        status: "open",
        state: "blocked",
        criteriaRevision: "revision",
        effort: "M",
        reasons: [{ code: "dependency-open", with: "BUD-2" }],
      },
    };
    expect(
      forecastSprints(data, { ...baseOptions, readiness }).weeks.map((week) =>
        week.members.map((member) => member.workId),
      ),
    ).toEqual([["BUD-2"], ["BUD-1"]]);
  });
  it("keeps unknown/oversized capacity and horizon input explicit", () => {
    expect(() =>
      forecastSprints(world([]), { ...baseOptions, capacity: 0 }),
    ).toThrow("Invalid forecast");
    expect(() =>
      forecastSprints(world([]), { ...baseOptions, weeks: 53 }),
    ).toThrow("Invalid forecast");
    expect(
      forecastSprints(world([item("BUD-1")]), { ...baseOptions, capacity: 1 })
        .unplanned[0].reason,
    ).toBe("Over weekly capacity");
  });
});
