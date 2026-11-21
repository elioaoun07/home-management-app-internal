import { describe, expect, it } from "vitest";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import {
  buildTimeline,
  cueBatch,
  cuesBetween,
  sceneAt,
} from "../../scripts/pm/app/localRunScene";
import { debriefChips } from "../../scripts/pm/app/Debrief";

const epoch = Date.parse("2026-11-15T10:00:00Z");
const at = (seconds: number) => new Date(epoch + seconds * 1000).toISOString();
const row = (
  seconds: number,
  kind: string,
  summary: string,
  seq = seconds,
) => ({ at: at(seconds), kind, summary, seq, job_id: "native" });
function run(changes: Partial<LocalRunView> = {}): LocalRunView {
  return {
    run_id: "local-fixture",
    phase: "building",
    workspace: "C:/fixture",
    branch: "delivery/R120",
    head: null,
    current_head: null,
    canShip: false,
    canUndo: false,
    interrupted: false,
    work: {
      id: "R120",
      title: "A retained delivery",
      brief:
        "- **Acceptance:** First.\n- **Acceptance:** Second.\n- Other detail.",
    },
    activity: [row(0, "status", "Native session started")],
    checks: [],
    usage: null,
    handover: null,
    ...changes,
  };
}

describe("Local recorded scene", () => {
  it("powers down at the decoded fault station while retaining recorded plates", () => {
    const activity = [
      row(0, "status", "Native session started"),
      row(1, "edit", "src/a.ts"),
      row(2, "status", "git commit: hook failed"),
    ];
    const timeline = buildTimeline(
      run({ phase: "failed", error: "git commit: hook failed", activity }),
    );
    expect(sceneAt(timeline, epoch + 2000)).toMatchObject({
      station: "forge",
      pose: "powered-down",
      plates: 1,
    });
    const setup = buildTimeline(
      run({
        phase: "failed",
        error: "worktree dependencies unavailable",
        activity: [],
      }),
    );
    expect(sceneAt(setup, epoch)).toMatchObject({
      station: "launch",
      phase: "failed",
    });
  });
  it("keeps recorder sequence when several rows share a timestamp", () => {
    const timeline = buildTimeline(
      run({
        phase: "uat-ready",
        activity: [
          row(0, "status", "Native session started", 1),
          row(0, "edit", "src/a.ts", 2),
          row(0, "status", "Host checks started", 3),
          row(0, "status", "Ready for owner UAT", 4),
        ],
      }),
    );
    expect(timeline.events.map((event) => event.id)).toEqual([
      "native:1",
      "native:2",
      "native:3",
      "native:4",
    ]);
    expect(sceneAt(timeline, epoch)).toMatchObject({
      phase: "uat-ready",
      station: "review",
      plates: 1,
    });
    const firstRow = sceneAt(timeline, epoch, "native:1");
    expect(firstRow).toMatchObject({ phase: "building", plates: 0 });
    expect(firstRow.events.map((event) => event.id)).toEqual(["native:1"]);
    expect(firstRow.run.activity).toHaveLength(1);
    expect(sceneAt(timeline, epoch, "native:2")).toMatchObject({
      phase: "building",
      plates: 1,
    });
    expect(sceneAt(timeline, epoch, "native:3")).toMatchObject({
      phase: "checking",
      plates: 1,
    });
  });

  it("masks final candidate facts until their recorded milestone", () => {
    const timeline = buildTimeline(
      run({
        phase: "shipped",
        head: "candidate",
        current_head: "current",
        merge: "merge",
        risk: {
          required: true,
          flagged: [{ path: "src/a.ts", domains: ["auth"] }],
        },
        usage: { total_tokens: 300 },
        activity: [
          row(0, "status", "Native session started"),
          row(1, "edit", "src/a.ts"),
          row(2, "status", "Host checks started"),
          row(3, "status", "Owner shipped merge"),
        ],
      }),
    );
    expect(sceneAt(timeline, epoch + 1000).run).toMatchObject({
      head: null,
      current_head: null,
      merge: null,
      usage: null,
      handover: null,
    });
    expect(sceneAt(timeline, epoch + 1000).run.risk).toBeUndefined();
    expect(sceneAt(timeline, epoch + 2000).run).toMatchObject({
      head: "candidate",
      current_head: "current",
      risk: { required: true },
      merge: null,
    });
    expect(sceneAt(timeline, epoch + 3000).run).toMatchObject({
      merge: "merge",
      usage: { total_tokens: 300 },
    });
  });

  it("does not leak a same-time host check past a row cursor", () => {
    const timeline = buildTimeline(
      run({
        phase: "checking",
        activity: [
          row(0, "status", "Native session started", 1),
          row(0, "status", "Host checks started", 2),
          row(0, "status", "typecheck: 0", 3),
        ],
        checks: [
          {
            name: "typecheck",
            exit: 0,
            stdout: "",
            stderr: "",
            error: null,
            finished_at: at(0),
          },
        ],
      }),
    );
    expect(sceneAt(timeline, epoch, "native:2").counts.checks).toBe(0);
    expect(sceneAt(timeline, epoch, "native:3").counts.checks).toBe(1);
  });

  it("does not award a small-file chip for anonymous Claude observations", () => {
    const record = run({
      phase: "shipped",
      activity: [
        row(0, "status", "Native session started"),
        row(1, "tool", "Edit"),
        row(2, "status", "Owner shipped merge"),
      ],
    });
    const timeline = buildTimeline(record),
      scene = sceneAt(timeline, epoch + 2000);
    expect(
      debriefChips(record, timeline, scene).map((chip) => chip.title),
    ).not.toContain("≤ 3 files");
  });

  it("small-file evidence counts changed files and duration needs a retained start", () => {
    const record = run({
      phase: "shipped",
      activity: [
        row(0, "status", "Native session started"),
        row(1, "command", "cat src/read.ts"),
        row(2, "edit", "src/edited.ts"),
        row(3, "status", "Owner shipped merge"),
      ],
    });
    const timeline = buildTimeline(record),
      scene = sceneAt(timeline, epoch + 3000);
    expect(debriefChips(record, timeline, scene)).toContainEqual({
      title: "≤ 3 files",
      fact: "1",
    });
    const missingStart = { ...timeline, events: timeline.events.slice(1) };
    expect(
      debriefChips(record, missingStart, scene).map((chip) => chip.title),
    ).not.toContain("Under 10 min");
  });

  it("accumulates distinct files and upgrades a read node instead of duplicating it", () => {
    const timeline = buildTimeline(
      run({
        activity: [
          row(0, "status", "Native session started"),
          row(1, "command", "cat src/app/api/route.ts"),
          row(2, "edit", "src/app/api/route.ts"),
          row(3, "edit", "src/app/api/route.ts"),
          row(4, "edit", "src/app/page.tsx"),
        ],
      }),
    );
    const read = sceneAt(timeline, epoch + 1500);
    expect(read.nodes).toMatchObject([
      { path: "src/app/api/route.ts", edited: false, area: "src/app/api" },
    ]);
    expect(read.plates).toBe(0);
    const final = sceneAt(timeline, epoch + 4000);
    expect(final.nodeCount).toBe(2);
    expect(final.plates).toBe(2);
    expect(final.counts).toMatchObject({
      files: 2,
      reads: 1,
      edits: 3,
      checks: 0,
    });
  });

  it("gives anonymous Claude observations their own nodes without claiming filenames", () => {
    const timeline = buildTimeline(
      run({
        activity: [
          row(0, "tool", "Read"),
          row(1, "tool", "Edit"),
          row(2, "tool", "Edit"),
        ],
      }),
    );
    const scene = sceneAt(timeline, epoch + 2000);
    expect(scene.nodes).toHaveLength(3);
    expect(scene.nodes.every((node) => node.path === null)).toBe(true);
    expect(scene.plates).toBe(2);
    expect(scene.counts.files).toBe(0);
  });

  it("earns seals only from completed host checks, never from commands or messages", () => {
    const timeline = buildTimeline(
      run({
        phase: "checking",
        activity: [
          row(0, "status", "Native session started"),
          row(1, "command", "pnpm typecheck"),
          row(2, "message", "All tests passed"),
          row(3, "status", "Host checks started"),
          row(20, "status", "typecheck: 0"),
        ],
        checks: [
          {
            name: "typecheck",
            started_at: at(3),
            finished_at: at(20),
            exit: 0,
            stdout: "",
            stderr: "",
            error: null,
          },
        ],
      }),
    );
    expect(sceneAt(timeline, epoch + 2000).counts.checks).toBe(0);
    expect(sceneAt(timeline, epoch + 10000).seals[0].state).toBe("pending");
    expect(
      sceneAt(timeline, epoch + 20000).seals.map((seal) => seal.state),
    ).toEqual(["passed", "pending", "pending", "pending"]);
  });

  it("keeps every check result distinct and in the supervisor order", () => {
    const checks = [
      { name: "pm:lint", exit: null, error: "timeout" },
      { name: "test", exit: 1, error: null },
      { name: "typecheck", exit: 0, error: null },
      { name: "lint", exit: null, error: null },
    ].map((check) => ({
      ...check,
      stdout: "",
      stderr: "",
      finished_at: at(2),
    }));
    const scene = sceneAt(buildTimeline(run({ checks })), epoch + 2000);
    expect(scene.seals.map((seal) => [seal.name, seal.state])).toEqual([
      ["typecheck", "passed"],
      ["lint", "inconclusive"],
      ["test", "failed"],
      ["pm:lint", "inconclusive"],
    ]);
  });

  it("does not leak a future failure or terminal phase into a replay frame", () => {
    const timeline = buildTimeline(
      run({
        phase: "failed",
        error: "git commit: hook failed",
        failure: { code: "commit-hook", step: "Seal", detail: "future hook reason" },
        activity: [
          row(0, "status", "Native session started"),
          row(10, "edit", "src/a.ts"),
          row(335, "status", "git commit: hook failed"),
        ],
      }),
    );
    const before = sceneAt(timeline, epoch + 10000);
    expect(before.phase).toBe("building");
    expect(before.run.error).toBeUndefined();
    expect(before.run.failure).toBeUndefined();
    expect(before.pose).toBe("forging");
    expect(sceneAt(timeline, epoch + 335000)).toMatchObject({
      phase: "failed",
      pose: "powered-down",
      plates: 1,
    });
    expect(sceneAt(timeline, epoch + 999000).elapsed).toBe(335000);
    expect(sceneAt(timeline, epoch + 335000).run.failure?.detail).toBe("future hook reason");
  });

  it("keeps acceptance pips unlit until the whole handover is accepted", () => {
    const handover = {
      acceptance: { state: "accepted" },
    } as LocalRunView["handover"];
    const timeline = buildTimeline(
      run({
        phase: "shipped",
        handover,
        activity: [
          row(0, "status", "Native session started"),
          row(20, "status", "Ready for owner UAT"),
          row(30, "status", "Owner shipped merge"),
        ],
      }),
    );
    expect(sceneAt(timeline, epoch + 20000)).toMatchObject({
      phase: "uat-ready",
      objectiveCount: 2,
      objectivesAccepted: false,
    });
    expect(sceneAt(timeline, epoch + 30000)).toMatchObject({
      objectiveCount: 2,
      objectivesAccepted: true,
    });
  });

  it("tracks observed subagents and preserves the current station during ordinary commands", () => {
    const timeline = buildTimeline(
      run({
        activity: [
          row(0, "status", "Native session started"),
          row(1, "command", "cat src/a.ts"),
          {
            ...row(2, "command", "node build.mjs"),
            agent_json: { role: "subagent", id: "worker-2" },
          },
        ],
      }),
    );
    const scene = sceneAt(timeline, epoch + 2000);
    expect(scene.station).toBe("source");
    expect(scene.subagents).toEqual([{ id: "worker-2", at: epoch + 2000 }]);
  });

  it("preserves the real quiet gap in phase bands and timeline timestamps", () => {
    const timeline = buildTimeline(
      run({
        phase: "uat-ready",
        activity: [
          row(0, "status", "Native session started"),
          row(10, "edit", "src/a.ts"),
          row(335, "status", "Host checks started"),
          row(340, "status", "Ready for owner UAT"),
        ],
      }),
    );
    expect(timeline.bands).toEqual([
      { phase: "building", at: epoch, end: epoch + 335000 },
      { phase: "checking", at: epoch + 335000, end: epoch + 340000 },
      { phase: "uat-ready", at: epoch + 340000, end: epoch + 340000 },
    ]);
    expect(timeline.end! - timeline.start!).toBe(340000);
  });

  it("initialises without historic cues, then deduplicates by recorded identity", () => {
    const first = buildTimeline(
      run({
        activity: [row(0, "tool", "Read", 80), row(1, "tool", "Edit", 81)],
      }),
    );
    const next = buildTimeline(
      run({
        activity: [row(1, "tool", "Edit", 81), row(2, "tool", "Read", 82)],
      }),
    );
    expect(cuesBetween(null, first)).toEqual([]);
    expect(cuesBetween(first, next).map((event) => event.id)).toEqual([
      "native:82",
    ]);
  });

  it("compresses a poll burst to 2.5 seconds while retaining cue order", () => {
    const timeline = buildTimeline(
      run({
        activity: Array.from({ length: 20 }, (_, index) =>
          row(index * 10, "tool", "Read"),
        ),
      }),
    );
    const batch = cueBatch(timeline.events);
    expect(batch[0].delay).toBe(0);
    expect(batch.at(-1)!.delay).toBeCloseTo(2500);
    expect(
      batch.every(
        (cue, index) => index === 0 || cue.delay > batch[index - 1].delay,
      ),
    ).toBe(true);
  });

  it("has no invented baseline for empty preparation and marks retained windows", () => {
    const empty = sceneAt(
      buildTimeline(run({ phase: "preparing", activity: [] })),
      epoch,
    );
    expect(empty.elapsed).toBeNull();
    const full = buildTimeline(
      run({
        activity: Array.from({ length: 200 }, (_, index) =>
          row(index, "tool", "Read"),
        ),
      }),
    );
    expect(full.truncated).toBe(true);
  });
});
