import { describe, expect, it } from "vitest";
import { cameraZone } from "../../scripts/pm/app/stage/cameraFacts";
import type { LocalActivityEvent } from "../../scripts/pm/app/localRunActivityModel";

const row = (kind: LocalActivityEvent["kind"], summary: string): LocalActivityEvent => ({
  id: "recorded-row", at: "2026-11-15T12:00:00Z", kind, summary,
  label: summary, detail: null, station: "forge", paths: [], command: null, agent: null,
});
describe("recorded camera destinations", () => {
  it("keeps a row's destination independent of decorative Think staging", () => {
    expect(cameraZone(row("edit", "src/recorded.ts"))).toBe("build");
    expect(cameraZone(row("read", "src/recorded.ts"))).toBe("explore");
    expect(cameraZone(row("message", "Recorded plan"))).toBe("think");
    expect(cameraZone(row("command", "pnpm typecheck"))).toBe("bench");
  });
  it("uses exact supervisor milestones for the remaining camera stops", () => {
    for (const [summary, zone] of [
      ["Run created", "brief"], ["Installing dependencies", "setup"],
      ["Native session started", "setup"], ["Committing candidate", "seal"],
      ["Hook: tests", "seal"], ["test started", "verify"],
      ["Freezing handover", "handover"], ["Owner opened diff review", "test"],
      ["Owner shipped merge", "ship"], ["Owner reverted merge", "ship"],
    ]) expect(cameraZone(row("event", summary))).toBe(zone);
  });
  it("does not turn narration, requested tools or missing evidence into milestones", () => {
    expect(cameraZone(row("message", "Installing dependencies"))).toBe("think");
    expect(cameraZone(row("command", "Hook: tests"))).toBe("bench");
    expect(cameraZone({ ...row("event", "Run created"), label: "Tool requested" })).toBeNull();
    expect(cameraZone(row("event", "Unrecorded guess"))).toBeNull();
    expect(cameraZone(null)).toBeNull();
  });
});
