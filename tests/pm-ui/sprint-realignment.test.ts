import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPlanningCommand,
  validatePlanning,
} from "../../scripts/pm/shared/planning.mjs";
import { realignmentPreview } from "../../scripts/pm/shared/sprint-realignment.mjs";
import { realignSprints } from "../../scripts/pm/realign-sprints.mjs";

const fixture = () =>
  validatePlanning({
    schema: "pm-planning@1",
    revision: 0,
    commands: [],
    deliverables: [
      { id: "release", title: "Release", targetDate: "2026-11-03" },
      { id: "old", title: "Past", targetDate: "2026-10-04" },
    ],
    sprints: [
      {
        id: "active",
        name: "Original name",
        goal: "Keep scope",
        startDate: "2026-10-19",
        endExclusive: "2026-10-26",
        timezone: "Asia/Beirut",
        strategy: "balanced",
        capacity: { unit: "points", available: 6, reviewMinutes: 90 },
        state: "active",
        members: [],
        commitment: {
          at: "2026-10-19T09:00:00Z",
          goal: "Keep scope",
          members: [],
        },
        scopeChanges: [],
        closed: null,
      },
      {
        id: "future",
        name: "Next",
        goal: "Release",
        startDate: "2026-10-28",
        endExclusive: "2026-11-04",
        timezone: "Asia/Beirut",
        strategy: "module",
        capacity: { unit: "points", available: 6, reviewMinutes: 90 },
        state: "draft",
        members: [
          {
            workId: "BUD-1",
            origin: { file: "Budget/4 - Checklist.md", alias: "BUD-1" },
            points: 2,
            reviewMinutes: null,
            deliverableId: "release",
          },
        ],
        commitment: null,
        scopeChanges: [],
        closed: null,
      },
      {
        id: "closed",
        name: "Past",
        goal: "Past",
        startDate: "2026-10-01",
        endExclusive: "2026-10-08",
        timezone: "Asia/Beirut",
        strategy: "balanced",
        capacity: { unit: "points", available: 6, reviewMinutes: 90 },
        state: "closed",
        members: [],
        commitment: { at: "2026-10-01T09:00:00Z", goal: "Past", members: [] },
        scopeChanges: [],
        closed: {
          at: "2026-10-08T09:00:00Z",
          delivered: [],
          cancelled: [],
          carryover: [],
        },
      },
    ],
  });
const command = (expectedRevision = 0, toDate = "2026-10-26") => ({
  action: "realign",
  toDate,
  expectedRevision,
  command_id: randomUUID(),
});

describe("sprint realignment", () => {
  it("keeps milestone dates shared with closed history fixed", () => {
    const before = fixture();
    const past = before.sprints[2];
    const member = {
      ...before.sprints[1].members[0],
      workId: "BUD-2",
      origin: { file: "Budget/4 - Checklist.md", alias: "BUD-2" },
    };
    past.members.push(member);
    past.commitment!.members.push({ ...member, criteriaRevision: "recorded" });
    past.closed!.delivered.push("BUD-2");
    const next = applyPlanningCommand(before, command());
    expect(next.deliverables).toEqual(before.deliverables);
    expect(next.sprints[2]).toEqual(before.sprints[2]);
  });
  it("translates dates across DST with exactly the same gaps, durations and scope", () => {
    const before = fixture();
    const next = applyPlanningCommand(before, command());
    expect(
      next.sprints.map((week) => [week.startDate, week.endExclusive]),
    ).toEqual([
      ["2026-10-26", "2026-11-02"],
      ["2026-11-04", "2026-11-11"],
      ["2026-10-01", "2026-10-08"],
    ]);
    next.sprints.forEach((week, index) => {
      expect({
        ...week,
        startDate: before.sprints[index].startDate,
        endExclusive: before.sprints[index].endExclusive,
      }).toEqual(before.sprints[index]);
    });
    expect(next.deliverables[0].targetDate).toBe("2026-11-10");
    expect(next.deliverables[1]).toEqual(before.deliverables[1]);
    expect(before.sprints[0].startDate).toBe("2026-10-19");
    const undone = applyPlanningCommand(next, command(1, "2026-10-19"));
    expect(undone.sprints).toEqual(before.sprints);
    expect(undone.deliverables).toEqual(before.deliverables);
  });
  it("rejects stale commands, invalid days, no-op and overlap with closed history", () => {
    expect(() => applyPlanningCommand(fixture(), command(99))).toThrow(
      /changed/,
    );
    expect(() =>
      applyPlanningCommand(fixture(), command(0, "2026-02-30")),
    ).toThrow(/Invalid/);
    expect(() =>
      applyPlanningCommand(fixture(), command(0, "2026-10-19")),
    ).toThrow(/already aligned/);
    expect(() =>
      applyPlanningCommand(fixture(), command(0, "2026-10-02")),
    ).toThrow(/closed sprint/);
    const closed = fixture();
    closed.sprints = closed.sprints.filter((week) => week.state === "closed");
    expect(() => realignmentPreview(closed, "2026-11-14")).toThrow(
      /No unfinished/,
    );
  });
  it("replays a command without applying its offset twice", () => {
    const action = command();
    const next = applyPlanningCommand(fixture(), action, { hash: "same" });
    expect(applyPlanningCommand(next, action, { hash: "same" })).toEqual(next);
    expect(() =>
      applyPlanningCommand(next, action, { hash: "different" }),
    ).toThrow(/reused/);
  });
  it("CLI previews without writing and applies with a byte-exact backup", () => {
    const root = mkdtempSync(join(tmpdir(), "era-realign-"));
    try {
      const pm = join(root, "ERA Notes", "10 - Project Management");
      mkdirSync(pm, { recursive: true });
      const file = join(pm, "_Planning.json");
      const original = JSON.stringify(fixture());
      writeFileSync(file, original);
      const preview = realignSprints({ root, toDate: "2026-10-26" });
      expect(preview.days).toBe(7);
      expect(preview.applied).toBe(false);
      expect(readFileSync(file, "utf8")).toBe(original);
      expect(
        realignSprints({ root, toDate: "2026-10-26", apply: true }).applied,
      ).toBe(true);
      const saved = JSON.parse(readFileSync(file, "utf8"));
      expect(saved.revision).toBe(1);
      const dir = join(root, ".pm", "planning-backups");
      expect(readdirSync(dir)).toHaveLength(1);
      expect(readFileSync(join(dir, readdirSync(dir)[0]), "utf8")).toBe(
        original,
      );
      expect(
        realignSprints({ root, toDate: "2026-10-26", apply: true }).applied,
      ).toBe(false);
      expect(JSON.parse(readFileSync(file, "utf8")).revision).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
