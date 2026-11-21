import { describe, expect, it } from "vitest";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import {
  zoneEvidence,
  zoneForEvent,
} from "../../scripts/pm/app/stage/zoneModel";
import {
  at,
  boardRun,
  epoch,
  handover,
  passedChecks,
  row,
} from "./local-board-fixtures";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";

function evidence(run: LocalRunView, seconds = 30) {
  return zoneEvidence(sceneAt(buildTimeline(run), epoch + seconds * 1000));
}
const status = (facts: ReturnType<typeof evidence>, id: string) =>
  facts.zones.find((zone) => zone.id === id)!;

describe("Eleven-zone evidence table", () => {
  it.each([
    "Installing dependencies",
    "Committing candidate",
    "Host checks started",
    "typecheck started",
    "Freezing handover",
    "Ready for owner UAT",
    "Native session started",
  ])("native rows quoting %s cannot provide supervisor evidence", (summary) => {
    for (const [kind, expected] of [
      ["message", "think"],
      ["command", "bench"],
      ["tool", null],
    ] as const) {
      const run = boardRun({
        phase: "building",
        activity: [row(1, kind, summary)],
      });
      const scene = sceneAt(buildTimeline(run), epoch + 2000);
      expect(zoneForEvent(scene.latest)).toBe(expected);
      const facts = zoneEvidence(scene);
      expect(status(facts, "setup").status).toBe("off");
      expect(status(facts, "handover").status).toBe("off");
      expect(status(facts, "seal").status).toBe("off");
    }
  });
  it("missing Native start or capped history cannot prove unused work zones were skipped", () => {
    const missing = evidence(
      boardRun({ phase: "checking", head: "candidate-a", activity: [] }),
    );
    for (const id of ["explore", "think", "build", "bench"])
      expect(status(missing, id)).toMatchObject({
        status: "off",
        skipped: false,
      });
    const capped = evidence(
      boardRun({
        phase: "checking",
        head: "candidate-a",
        activity: [
          row(0, "status", "Native session started"),
          ...Array.from({ length: 199 }, (_, index) =>
            row(index + 1, "message", "Recorded note"),
          ),
        ],
      }),
      201,
    );
    expect(status(capped, "think").status).toBe("done");
    for (const id of ["explore", "build", "bench"])
      expect(status(capped, id)).toMatchObject({
        status: "off",
        skipped: false,
      });
    expect(capped.doneCount).toBe(3);
  });
  it("keeps unreached zones unlit and marks BRIEF only with an actual brief", () => {
    const empty = evidence(boardRun({ phase: "preparing", activity: [] }));
    expect(empty.zones.map((zone) => zone.id)).toEqual([
      "brief",
      "setup",
      "explore",
      "think",
      "build",
      "bench",
      "seal",
      "verify",
      "handover",
      "test",
      "ship",
    ]);
    expect(empty.doneCount).toBe(0);
    expect(status(empty, "setup").status).toBe("active");
    expect(
      empty.zones
        .filter((zone) => zone.id !== "setup")
        .every((zone) => zone.status === "off"),
    ).toBe(true);
    const brief = evidence(
      boardRun({
        phase: "preparing",
        activity: [],
        work: { id: "R123", title: "Fixture", brief: "Recorded brief" },
      }),
    );
    expect(status(brief, "brief").status).toBe("done");
  });
  it("SETUP completion requires Native session started, not phase or tool rows", () => {
    expect(
      status(
        evidence(boardRun({ activity: [row(1, "edit", "src/a.ts")] })),
        "setup",
      ).status,
    ).toBe("off");
    expect(status(evidence(boardRun()), "setup").status).toBe("done");
  });
  it("counts the four work kinds and marks only used zones done after building", () => {
    const run = boardRun({
      phase: "checking",
      head: "candidate-a",
      activity: [
        row(0, "status", "Native session started"),
        row(1, "command", "Get-Content src/a.ts"),
        row(2, "message", "Recorded note"),
        row(3, "edit", "src/a.ts, src/b.ts"),
        row(4, "command", "pnpm typecheck"),
        row(5, "status", "Host checks started"),
      ],
    });
    const facts = evidence(run);
    for (const id of ["explore", "think", "build", "bench"])
      expect(status(facts, id)).toMatchObject({
        count: 1,
        status: "done",
        skipped: false,
      });
    const noWork = evidence(
      boardRun({ phase: "checking", head: "candidate-a" }),
    );
    for (const id of ["explore", "think", "build", "bench"])
      expect(status(noWork, id)).toMatchObject({
        count: 0,
        status: "skipped",
        done: false,
      });
    expect(noWork.doneCount).toBe(6);
  });
  it("does not skip work zones before building or after a setup failure", () => {
    expect(evidence(boardRun()).zones.some((zone) => zone.skipped)).toBe(false);
    expect(
      evidence(
        boardRun({
          phase: "failed",
          activity: [],
          error: "worktree dependencies unavailable",
        }),
      ).zones.some((zone) => zone.skipped),
    ).toBe(false);
  });
  it("stages reads/messages/edits/native checks in their zones and Think stage at THINK", () => {
    const run = boardRun({ activity: [row(1, "command", "pnpm typecheck")] });
    const scene = sceneAt(buildTimeline(run), epoch + 2000),
      event = scene.events[0];
    expect(zoneForEvent(event)).toBe("bench");
    expect(zoneEvidence(scene, { event, stage: "work" }).activeZone).toBe(
      "bench",
    );
    expect(zoneEvidence(scene, { event, stage: "think" }).activeZone).toBe(
      "think",
    );
    expect(
      status(zoneEvidence(scene, { event, stage: "work" }), "verify").status,
    ).toBe("off");
  });
  it("SEAL lights active only from explicit supervisor row, and done only from head", () => {
    expect(
      status(
        evidence(
          boardRun({
            activity: [row(1, "message", "I am committing candidate")],
          }),
        ),
        "seal",
      ).status,
    ).toBe("off");
    expect(
      status(
        evidence(
          boardRun({ activity: [row(1, "status", "Committing candidate")] }),
        ),
        "seal",
      ).status,
    ).toBe("active");
    expect(
      status(evidence(boardRun({ head: "candidate-a" })), "seal").status,
    ).toBe("done");
  });
  it("VERIFY requires all four actual successful supervisor checks", () => {
    expect(
      status(
        evidence(
          boardRun({ phase: "checking", checks: passedChecks().slice(0, 3) }),
        ),
        "verify",
      ).status,
    ).toBe("active");
    expect(
      status(
        evidence(boardRun({ phase: "uat-ready", checks: passedChecks() })),
        "verify",
      ).status,
    ).toBe("done");
    const checks = passedChecks();
    checks[3].error = "Recorded check error";
    expect(
      status(
        evidence(
          boardRun({ phase: "failed", error: "host checks failed", checks }),
        ),
        "verify",
      ).status,
    ).toBe("fault");
  });
  it("selects the actual fixed-order running hoop, never from agent check commands", () => {
    expect(
      evidence(
        boardRun({ phase: "checking", checks: passedChecks().slice(0, 2) }),
      ).runningCheck,
    ).toBe("test");
    expect(
      evidence(boardRun({ phase: "checking", checks: passedChecks() }))
        .runningCheck,
    ).toBeNull();
    expect(
      evidence(boardRun({ activity: [row(2, "command", "pnpm typecheck")] }))
        .runningCheck,
    ).toBeNull();
  });
  it("HANDOVER requires its recorded ready row, and TEST requires accepted plus required review", () => {
    const run = boardRun({
      phase: "uat-ready",
      head: "candidate-a",
      handover: handover(true),
      risk: { required: true, flagged: [] },
    });
    expect(status(evidence(run), "handover").status).toBe("off");
    expect(status(evidence(run), "test").status).toBe("active");
    expect(
      status(
        evidence({
          ...run,
          reviewed_head: "candidate-a",
          activity: [row(20, "status", "Ready for owner UAT")],
        }),
        "test",
      ).status,
    ).toBe("done");
    expect(
      status(
        evidence({ ...run, risk: { required: false, flagged: [] } }),
        "test",
      ).status,
    ).toBe("done");
  });
  it("SHIP phase alone does not complete preceding evidence lamps", () => {
    const facts = evidence(boardRun({ phase: "shipped", activity: [] }));
    expect(status(facts, "ship").status).toBe("done");
    expect(facts.atMain).toBe(true);
    expect(status(facts, "verify").status).toBe("off");
    expect(status(facts, "handover").status).toBe("off");
    expect(
      status(evidence(boardRun({ phase: "push-pending" })), "ship").status,
    ).toBe("off");
  });
  it.each([
    ["worktree dependencies unavailable", "setup"],
    ["worktree contains a secret", "setup"],
    ["native session exited 1", "build"],
    ["native session did not confirm success", "build"],
    ["candidate needs a change", "build"],
    ["git commit: hook failed", "seal"],
    ["candidate changed during host checks", "verify"],
    ["handover incomplete", "handover"],
  ])("maps %s to fault %s without draining board colour", (error, id) => {
    const facts = evidence(boardRun({ phase: "failed", error }));
    expect(status(facts, id).status).toBe("fault");
    expect(facts.buildZone).toBe(id);
    expect(facts.activeZone).toBeNull();
    expect(facts.zones.filter((zone) => zone.status === "fault")).toHaveLength(
      1,
    );
  });
  it("attention lamp overlays retain LINE evidence and closed/interrupted never stage work", () => {
    const run = boardRun({ phase: "uat-ready", handover: handover(true) });
    const scene = sceneAt(buildTimeline(run), epoch + 30_000),
      prior = zoneEvidence(scene);
    const facts = zoneEvidence(scene, null, [
      { zone: "test", level: "act", state: "open" },
    ]);
    expect(status(facts, "test")).toMatchObject({
      status: "needs-you",
      done: true,
    });
    expect(facts.doneCount).toBe(prior.doneCount);
    const interrupted = sceneAt(
      buildTimeline({ ...run, phase: "building", interrupted: true }),
      epoch + 30_000,
    );
    expect(
      zoneEvidence(interrupted, {
        event: interrupted.events[0],
        stage: "think",
      }).activeZone,
    ).toBeNull();
  });
  it("replay does not expose future candidate, checks, handover or work counts", () => {
    const run = boardRun({
      phase: "shipped",
      head: "candidate-a",
      checks: passedChecks(),
      handover: handover(true),
      activity: [
        row(0, "status", "Native session started"),
        row(5, "edit", "src/a.ts"),
        row(10, "status", "Host checks started"),
        row(20, "status", "Ready for owner UAT"),
        row(25, "status", "Owner shipped merge"),
      ],
    });
    const facts = evidence(run, 1);
    expect(status(facts, "seal").status).toBe("off");
    expect(status(facts, "build").count).toBe(0);
    expect(status(facts, "verify").status).toBe("off");
    expect(facts.atMain).toBe(false);
    expect(at(1)).toBe("2026-11-15T12:00:01.000Z");
  });
});
