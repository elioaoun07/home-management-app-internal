import { describe, expect, it } from "vitest";
import { localRunAttention } from "../../scripts/pm/app/localRunAttention";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import {
  localBoardGame,
  localStageGame,
} from "../../scripts/pm/app/stage/game";
import { zoneEvidence } from "../../scripts/pm/app/stage/zoneModel";
import { boardRun, epoch, handover, row } from "./local-board-fixtures";
import type { LocalRunView } from "../../scripts/pm/app/LocalDelivery";

function game(run: LocalRunView, seen = new Set<string>(), seconds = 30) {
  const timeline = buildTimeline(run),
    scene = sceneAt(timeline, epoch + seconds * 1000);
  const attention = localRunAttention(scene.run, seen, scene.at);
  return localBoardGame(
    timeline,
    scene,
    zoneEvidence(scene, null, attention),
    attention,
  );
}
describe("R123 additive board game facts", () => {
  it("LINE counts done and explicitly skipped zones, with no percentage", () => {
    const result = game(boardRun({ phase: "checking", head: "candidate-a" }));
    expect(result.line).toBe(6);
    expect(result.lineTotal).toBe(11);
    expect(game(boardRun({ phase: "preparing", activity: [] })).line).toBe(0);
  });
  it("turn derives only from open acts, independent of look cards", () => {
    expect(game(boardRun()).turn).toBe("ERA'S TURN");
    expect(
      game(boardRun({ phase: "uat-ready", handover: handover() })).turn,
    ).toBe("YOUR TURN");
    expect(game(boardRun({ phase: "shipped" })).turn).toBeNull();
    expect(game(boardRun({ interrupted: true })).turn).toBeNull();
  });
  it("splits sum the retained timeline bands and do not invent missing Ship duration", () => {
    const run = boardRun({
      phase: "shipped",
      activity: [
        row(0, "status", "Preparing workspace"),
        row(2, "status", "Native session started"),
        row(12, "status", "Host checks started"),
        row(22, "status", "Ready for owner UAT"),
        row(27, "status", "Owner shipped merge"),
      ],
    });
    expect(game(run).splits).toEqual([
      { group: "setup", label: "SETUP", ms: 2000, partial: false },
      { group: "build", label: "BUILD", ms: 10_000, partial: false },
      { group: "verify", label: "VERIFY", ms: 10_000, partial: false },
      { group: "test", label: "TEST", ms: 5000, partial: false },
      { group: "ship", label: "SHIP", ms: 0, partial: false },
    ]);
    expect(game(run, new Set(), 8).splits).toEqual([
      { group: "setup", label: "SETUP", ms: 2000, partial: false },
      { group: "build", label: "BUILD", ms: 6000, partial: false },
    ]);
  });
  it("marks retained durations partial when activity hit its cap", () => {
    const run = boardRun({
      phase: "failed",
      error: "native session did not confirm success",
      activity: Array.from({ length: 200 }, (_, index) =>
        row(index, "message", `Recorded note ${index}`),
      ),
    });
    expect(
      game(run, new Set(), 201).splits.every((split) => split.partial),
    ).toBe(true);
    expect(game(boardRun({ activity: [] })).splits).toEqual([]);
  });
  it("RETRY follows the work-bound attempt suffix, not arbitrary branch differences", () => {
    expect(
      game(
        boardRun({
          branch: "delivery/R123-b7336adb-95be-4a6e-b922-270682645005",
        }),
      ).retry,
    ).toBe(true);
    expect(game(boardRun()).retry).toBe(false);
    expect(game(boardRun({ branch: "delivery/R123-" })).retry).toBe(false);
    expect(game(boardRun({ branch: "feature/R123-retry" })).retry).toBe(false);
    expect(game(boardRun({ branch: "delivery/R122-attempt" })).retry).toBe(
      false,
    );
  });
  it("Clean desk requires at least one real act and all acts done; looks do not block it", () => {
    expect(game(boardRun()).cleanDesk).toBe(false);
    const run = boardRun({
      phase: "uat-ready",
      handover: handover(true),
      work: { id: "R123", title: "Fixture", brief: "Recorded brief" },
    });
    expect(game(run)).toMatchObject({
      cleanDesk: true,
      badges: [{ id: "clean-desk", label: "Clean desk", fact: "1/1" }],
    });
    const sqlRun = { ...run, activity: [row(1, "edit", "migrations/a.sql")] };
    const sql = localRunAttention(sqlRun, new Set(), epoch + 30_000).find(
      (item) => item.kind === "sql",
    )!;
    expect(game(sqlRun).cleanDesk).toBe(false);
    expect(game(sqlRun, new Set([sql.id])).cleanDesk).toBe(true);
    const failure = boardRun({
      phase: "failed",
      error: "git commit: hook failed",
    });
    expect(game(failure).cleanDesk).toBe(false);
  });
  it("does not change R122 combo, rank, badges or canonical streak rules", () => {
    const run = boardRun(),
      timeline = buildTimeline(run),
      scene = sceneAt(timeline, epoch + 5000);
    const before = localStageGame(timeline, scene, 3);
    localBoardGame(timeline, scene, zoneEvidence(scene), []);
    expect(localStageGame(timeline, scene, 3)).toEqual(before);
  });
});
