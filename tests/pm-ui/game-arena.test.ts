import { describe, expect, it } from "vitest";
import { cleanEvidence, gameFacts } from "../../scripts/pm/app/gameModel";
import { compareArena } from "../../scripts/pm/app/arenaModel";
import { sessionScorecard } from "../../scripts/os/scorecard.mjs";
import type { Cockpit, Flight } from "../../scripts/pm/app/cockpitTypes";

function flight(id: string, day = 1): Flight {
  const record: Flight = {
    session: {
      id,
      agent: "claude",
      coverage: "transcript",
      tier: "CLAUDE_MID",
      effort: "medium",
      base: "a".repeat(40),
      head: "b".repeat(40),
      startedAt: `2026-11-0${day}T10:00:00Z`,
      endedAt: `2026-11-0${day}T10:01:00Z`,
      setup: { fingerprint: "sha256:setup" },
      skills: [],
      reads: [],
      timeline: [],
      usage: {},
      turns: null,
    },
    events: [],
    verdicts: Array.from({ length: 29 }, (_, i) => ({
      rule: `HR-${i + 1}`,
      verdict: "pass",
      level: "checked",
      added: 0,
      removed: 0,
    })),
    checks: [
      "typecheck",
      "lint",
      "test",
      "pm:lint",
      "docs:check",
      "os:check",
    ].map((name) => ({ id: name, name, source: "supervisor", exitCode: 0 })),
  };
  record.session.scorecard = sessionScorecard(record, []);
  return record;
}
const cockpit = (records: Flight[]): Cockpit => ({
  setup: null,
  records,
  deliveries: [],
  groups: [],
  conflicts: [],
  warnings: [],
  filed: [],
});
function bind(record: Flight) {
  record.session.arena = {
    caseId: "KIT-11",
    caseFingerprint: "sha256:case",
    start: "a".repeat(40),
    oracleHash: "sha256:oracle",
    oracleVerdict: "pass",
    isolation: "protected",
  };
  return record;
}
describe("R99 honest game measurements", () => {
  it("does not turn missing checks or incomplete rule coverage into clean work", () => {
    const full = flight("full");
    expect(cleanEvidence(full)).toBe("clean");
    const unknown = flight("unknown");
    unknown.checks = [];
    unknown.session.scorecard = sessionScorecard(unknown);
    expect(cleanEvidence(unknown)).toBe("unknown");
    if (!full.session.scorecard) throw Error("missing scorecard");
    full.session.scorecard.rules.facts =
      full.session.scorecard.rules.facts.filter((r) => r.rule !== "HR-22");
    expect(cleanEvidence(full)).toBe("unknown");
  });
  it("counts only consecutive clean sessions and keeps the failed boundary", () => {
    const failed = flight("failed", 1);
    failed.checks[0].exitCode = 1;
    failed.session.scorecard = sessionScorecard(failed);
    const facts = gameFacts(cockpit([failed, flight("new", 2)]));
    expect(facts.streak.map((r) => r.session.id)).toEqual(["new"]);
    expect(facts.boundary?.session.id).toBe("failed");
  });
  it("does not reward unknown chronology or Arena exercise volume", () => {
    const unknown = flight("unknown");
    unknown.session.endedAt = null;
    expect(gameFacts(cockpit([unknown, flight("new", 2)])).unordered).toBe(
      true,
    );
    expect(
      gameFacts(cockpit([flight("tie-a"), flight("tie-b")])).unordered,
    ).toBe(true);
    expect(
      gameFacts(
        cockpit([bind(flight("exercise")), flight("product", 2)]),
      ).streak.map((r) => r.session.id),
    ).toEqual(["product"]);
  });
  it("never invents guard coverage or baseline debt", () => {
    const facts = gameFacts(cockpit([]));
    expect(facts.guarded).toEqual([]);
    expect(facts.debt).toEqual([]);
    expect(facts.parity).toEqual([]);
  });
});
describe("R99 frozen-case comparison", () => {
  it("accepts two differently tiered agents only with matching case, start, effort, setup and protected oracle", () => {
    const a = bind(flight("a")),
      b = bind(flight("b"));
    b.session.agent = "codex";
    b.session.tier = "CODEX_MID";
    b.session.scorecard = sessionScorecard(b, []);
    expect(compareArena(a, b)).toEqual({ comparable: true, reasons: [] });
    if (!b.session.arena) throw Error("missing arena");
    b.session.arena.isolation = "unverified";
    expect(compareArena(a, b).reasons).toContain("Oracle isolation unverified");
    b.session.arena.isolation = "protected";
    b.session.arena.oracleHash = "different";
    expect(compareArena(a, b).reasons).toContain("Different oracles");
    b.session.arena.oracleHash = a.session.arena?.oracleHash || "";
    b.session.base = "different";
    expect(compareArena(a, b).reasons).toContain("Different starting commits");
    b.session.base = a.session.base;
    b.session.effort = "high";
    expect(compareArena(a, b).reasons).toContain(
      "Effort differs or is unrecorded",
    );
  });
  it("does not call ordinary or missing scorecards a controlled comparison", () => {
    expect(compareArena(flight("a"), flight("b")).reasons).toContain(
      "Case binding unrecorded",
    );
    expect(compareArena().comparable).toBe(false);
    const a = bind(flight("a")),
      b = bind(flight("b"));
    b.session.setup = null;
    expect(compareArena(a, b).reasons).toContain(
      "Setup differs or is unrecorded",
    );
    b.session.scorecard = undefined;
    expect(compareArena(a, b).reasons).toContain("Scorecard unrecorded");
  });
});
