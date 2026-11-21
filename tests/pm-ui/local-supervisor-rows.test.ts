import { describe, expect, it } from "vitest";
import { localRunActivity } from "../../scripts/pm/app/localRunActivityModel";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import {
  zoneEvidence,
  zoneForEvent,
} from "../../scripts/pm/app/stage/zoneModel";
import { boardRun, epoch, passedChecks, row } from "./local-board-fixtures";

describe("R123 additive supervisor rows", () => {
  it.each([
    ["Installing dependencies", "launch", "setup"],
    ["Committing candidate", "forge", "seal"],
    ["Hook: docs", "forge", "seal"],
    ["Hook: mirrors", "forge", "seal"],
    ["Hook: manifests", "forge", "seal"],
    ["Hook: typecheck", "forge", "seal"],
    ["Hook: tests", "forge", "seal"],
    ["Hook: lint", "forge", "seal"],
    ["Freezing handover", "review", "handover"],
    ["typecheck started", "lab", "verify"],
    ["lint started", "lab", "verify"],
    ["test started", "lab", "verify"],
    ["pm:lint started", "lab", "verify"],
  ])(
    "maps actual status %s without manufacturing a result",
    (summary, station, zone) => {
      const run = boardRun({ activity: [row(1, "status", summary)] });
      const activity = localRunActivity(run),
        event = activity.events[0];
      expect(event).toMatchObject({ kind: "event", label: summary, station });
      expect(zoneForEvent(event)).toBe(zone);
      expect(activity.counts.checks).toBe(0);
      expect(run.checks).toEqual([]);
      expect(run.head).toBeNull();
    },
  );
  it.each([
    "Installing dependencies",
    "Committing candidate",
    "Hook: docs",
    "Hook: mirrors",
    "Hook: manifests",
    "Hook: typecheck",
    "Hook: tests",
    "Hook: lint",
    "Freezing handover",
    "typecheck started",
  ])(
    "a native quote or untyped observation of %s does not supply supervisor evidence",
    (summary) => {
      for (const kind of ["message", "command", "tool"]) {
        const event = localRunActivity(
          boardRun({ activity: [row(1, kind, summary)] }),
        ).events[0];
        expect(zoneForEvent(event)).toBe(
          kind === "message" ? "think" : kind === "command" ? "bench" : null,
        );
      }
      const event = localRunActivity(
        boardRun({
          activity: [{ at: new Date(epoch + 1000).toISOString(), summary }],
        }),
      ).events[0];
      expect(zoneForEvent(event)).toBeNull();
    },
  );
  it("Freezing handover takes the active zone and carrier to HANDOVER before Ready, without claiming completion", () => {
    const run = boardRun({
      phase: "checking",
      head: "candidate-a",
      checks: passedChecks(),
      activity: [
        row(0, "status", "Native session started"),
        row(5, "status", "Host checks started"),
        row(20, "status", "Freezing handover"),
      ],
    });
    const facts = zoneEvidence(sceneAt(buildTimeline(run), epoch + 21_000));
    expect(facts).toMatchObject({
      activeZone: "handover",
      buildZone: "handover",
      runningCheck: null,
    });
    expect(facts.zones.find((zone) => zone.id === "handover")).toMatchObject({
      status: "active",
      done: false,
    });
    expect(facts.zones.find((zone) => zone.id === "verify")?.status).toBe(
      "done",
    );
    const quote = {
      ...run,
      activity: [
        ...run.activity.slice(0, -1),
        row(20, "message", "Freezing handover"),
      ],
    };
    expect(
      zoneEvidence(sceneAt(buildTimeline(quote), epoch + 21_000)).buildZone,
    ).toBe("verify");
  });
});
