import { describe, expect, it } from "vitest";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";

const epoch = Date.parse("2026-11-15T12:00:00Z");
const row = (second: number, kind: string, summary: string, seq = second) => ({
  at: new Date(epoch + second * 1000).toISOString(),
  kind,
  summary,
  seq,
  job_id: "native",
});
function run(activity: LocalRunView["activity"]): LocalRunView {
  return {
    run_id: "local-provenance-regression",
    phase: "shipped",
    workspace: "C:/fixture",
    branch: "delivery/R123",
    head: "candidate-future",
    current_head: "candidate-future",
    canShip: false,
    canUndo: false,
    interrupted: false,
    work: { id: "R123", title: "Fixture" },
    risk: {
      required: true,
      flagged: [{ path: "migrations/future.sql", domains: ["schema"] }],
    },
    merge: "merge-future",
    usage: { input: 10, output: 2 },
    checks: [],
    handover: null,
    activity,
  };
}

describe("Recorded Local phase and candidate supervisor provenance", () => {
  const milestones = [
    "Native session started",
    "Host checks started",
    "Ready for owner UAT",
    "Owner opened diff review",
    "Owner shipped merge",
    "Owner reverted merge",
  ];
  it.each(milestones)(
    "native rows quoting %s cannot advance phase or expose future candidate facts",
    (summary) => {
      for (const kind of ["message", "command", "tool"]) {
        const setupQuote = summary === "Native session started";
        const value = run([
          row(
            0,
            "status",
            setupQuote ? "Preparing workspace" : "Native session started",
          ),
          row(1, kind, summary),
          row(2, "edit", "src/later.ts"),
          row(3, "status", "Host checks started"),
          row(4, "status", "Ready for owner UAT"),
          row(5, "status", "Owner shipped merge"),
        ]);
        const scene = sceneAt(buildTimeline(value), epoch + 1100);
        expect(scene.phase).toBe(
          setupQuote && kind !== "command" ? "preparing" : "building",
        );
        expect(scene.run.head).toBeNull();
        expect(scene.run.current_head).toBeNull();
        expect(scene.run.risk).toBeUndefined();
        expect(scene.run.merge).toBeNull();
        expect(scene.run.usage).toBeNull();
        expect(scene.run.handover).toBeNull();
        expect(scene.objectivesAccepted).toBe(false);
        expect(scene.counts.checks).toBe(0);
      }
    },
  );
  it("disambiguates a tied quote before the actual supervisor candidate row", () => {
    const value = run([
      row(0, "status", "Native session started"),
      row(1, "message", "Host checks started", 1),
      row(1, "status", "Host checks started", 2),
      row(2, "status", "Ready for owner UAT", 3),
      row(3, "status", "Owner shipped merge", 4),
    ]);
    const timeline = buildTimeline(value),
      before = sceneAt(timeline, epoch + 1000, "native:1");
    expect(before.phase).toBe("building");
    expect(before.run.head).toBeNull();
    expect(before.run.risk).toBeUndefined();
    const after = sceneAt(timeline, epoch + 1000, "native:2");
    expect(after.phase).toBe("checking");
    expect(after.run.head).toBe("candidate-future");
  });
  it("an agent's own result-shaped command cannot become a host check or candidate", () => {
    const value = run([
      row(0, "status", "Native session started"),
      row(1, "command", "typecheck: 0"),
      row(2, "edit", "src/later.ts"),
      row(3, "status", "Host checks started"),
      row(4, "status", "Owner shipped merge"),
    ]);
    const scene = sceneAt(buildTimeline(value), epoch + 1100);
    expect(scene.phase).toBe("building");
    expect(scene.run.head).toBeNull();
    expect(scene.seals.every((seal) => seal.state === "pending")).toBe(true);
  });
  it("actual supervisor milestones retain their original phases and candidate visibility", () => {
    const value = run([
      row(0, "status", "Preparing workspace"),
      row(1, "status", "Native session started"),
      row(2, "status", "Host checks started"),
      row(3, "status", "Ready for owner UAT"),
      row(4, "status", "Owner shipped merge"),
    ]);
    const timeline = buildTimeline(value);
    expect(sceneAt(timeline, epoch + 1000, "native:1").phase).toBe("building");
    expect(sceneAt(timeline, epoch + 2000, "native:2").phase).toBe("checking");
    expect(sceneAt(timeline, epoch + 2000, "native:2").run.head).toBe(
      "candidate-future",
    );
    expect(sceneAt(timeline, epoch + 3000, "native:3").phase).toBe("uat-ready");
    expect(sceneAt(timeline, epoch + 4000, "native:4").phase).toBe("shipped");
  });
});
