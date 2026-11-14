import { describe, expect, it } from "vitest";
import { bridgeCharts, bridgeState } from "../../scripts/pm/app/bridgeModel";
import { buildWorld } from "../../scripts/pm/app/model";
import { sessionScorecard } from "../../scripts/os/scorecard.mjs";
import type { Flight } from "../../scripts/pm/app/cockpitTypes";

function flight(id: string, quality: "clean" | "failed" | "unknown"): Flight {
  const record: Flight = {
    session: {
      id, agent: "claude", coverage: "transcript", tier: "CLAUDE_MID", effort: "medium",
      startedAt: "2026-11-14T10:00:00Z", endedAt: "2026-11-14T10:01:00Z",
      skills: [], reads: [], timeline: [], usage: {}, turns: null,
    },
    events: [],
    verdicts: Array.from({ length: 29 }, (_, i) => ({
      rule: `HR-${i + 1}`, verdict: "pass", level: "checked", added: 0, removed: 0,
    })),
    checks: ["typecheck", "lint", "test", "pm:lint", "docs:check", "os:check"].map((name) => ({
      id: name, name, source: "supervisor", exitCode: 0,
    })),
  };
  if (quality === "failed") record.checks[0].exitCode = 1;
  if (quality === "unknown") record.checks = [];
  record.session.scorecard = sessionScorecard(record, []);
  return record;
}

describe("Bridge evidence", () => {
  it("does not convert missing delivery observations into an idle system", () => {
    expect(bridgeState(0, 0, true).state).toBe("unknown");
    expect(bridgeState(0, 0, false).state).toBe("idle");
    expect(bridgeState(0, 1, true)).toMatchObject({ state: "running", value: 1 });
    expect(bridgeState(2, 1, true)).toMatchObject({ state: "running", value: 1 });
  });

  it("plots only dated, distinct shipped outcomes in its eight-week window", () => {
    const world = buildWorld({
      generatedAt: "2026-11-14T10:00:00Z",
      files: [
        { relPath: "Budget/4 - Checklist.md", raw: "## Now\n- [ ] **BUD-3** Reopened _(friction - S)_\n" },
        { relPath: "Budget/Budget — Master Book.md", raw: [
          "## Shipped Log",
          "- ✅ 2026-11-10 — **BUD-1** Shipped.",
          "- ✅ 2026-11-11 — **BUD-1** Duplicate receipt.",
          "- ✅ 2026-11-11 — **BUD-2** Shipped.",
          "- ✅ 2026-11-11 — **BUD-3** Reopened.",
          "- ✅ *(date unrecorded)* — **BUD-4** Undated.",
          "- ✅ 2026-01-01 — **BUD-5** Earlier.",
          "- ✅ 2026-12-01 — **BUD-6** Future.",
        ].join("\n") },
      ],
    });
    const charts = bridgeCharts(world, "2026-11-14");
    expect(charts.shipped.buckets).toHaveLength(8);
    expect(charts.shippedCount).toBe(2);
    expect(charts.shipped.undated.completed).toHaveLength(1);
    expect(charts.shipped.before.completed).toHaveLength(1);
    expect(charts.shipped.after.completed).toHaveLength(1);
    expect(charts.sessionCount).toBe(0);
  });

  it("keeps unknown session quality separate and excludes Arena exercises", () => {
    const world = buildWorld({ generatedAt: "2026-11-14T10:00:00Z", files: [] });
    const arena = flight("arena", "clean");
    arena.session.arena = {
      caseId: "KIT-11", caseFingerprint: "sha256:test", start: "a".repeat(40),
      oracleHash: "sha256:test", oracleVerdict: "pass", isolation: "protected",
    };
    world.cockpit = {
      setup: null, records: [flight("clean", "clean"), flight("failed", "failed"), flight("unknown", "unknown"), arena],
      deliveries: [], groups: [], conflicts: [], warnings: [], filed: [],
    };
    const charts = bridgeCharts(world, "2026-11-14");
    expect(charts.quality.map((group) => [group.state, group.records.map((record) => record.session.id)]))
      .toEqual([["clean", ["clean"]], ["failed", ["failed"]], ["unknown", ["unknown"]]]);
    expect(charts.sessionCount).toBe(3);
    expect(charts.shippedCount).toBe(0);
  });
});
