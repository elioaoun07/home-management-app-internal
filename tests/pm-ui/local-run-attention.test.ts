import { describe, expect, it } from "vitest";
import {
  attentionId,
  localRunAttention,
  sortAttention,
} from "../../scripts/pm/app/localRunAttention";
import { at, boardRun, epoch, handover, row } from "./local-board-fixtures";

const attention = (run = boardRun(), seen = new Set<string>(), seconds = 30) =>
  localRunAttention(run, seen, epoch + seconds * 1000);

describe("Local attention evidence", () => {
  it("shows the recorded reason in the Game rail before raw hook chatter", () => {
    const run = boardRun({ phase: "failed", error: "raw hook chatter", failure: { code: "commit-hook", step: "Seal", detail: " FAIL tests/fixture.test.ts\nAssertionError: recorded reason" } });
    expect(attention(run).find(item => item.kind === "failed")).toMatchObject({ title: "Commit hook failed", zone: "seal", detail: "Seal ·  FAIL tests/fixture.test.ts\nAssertionError: recorded reason" });
  });
  it("raises Brief as a look item and remembers only its own stable local acknowledgement", () => {
    const run = boardRun({
      work: { id: "R123", title: "Fixture", brief: "Recorded brief" },
    });
    const id = attentionId(run.run_id, "plan", "brief");
    expect(attention(run)[0]).toMatchObject({
      id,
      kind: "plan",
      level: "look",
      title: "Brief",
      zone: "brief",
      state: "open",
      since: null,
    });
    expect(attention(run, new Set([id]))[0].state).toBe("done");
    expect(attention(boardRun()).some((item) => item.kind === "plan")).toBe(
      false,
    );
  });
  it("never turns Local prose or an invented phase into a plan approval or question", () => {
    const run = boardRun({
      phase: "awaiting-question",
      activity: [
        row(1, "message", "Approve my plan? Which option do you choose?"),
      ],
    });
    expect(
      attention(run).filter(
        (item) => item.kind === "question" || item.level === "act",
      ),
    ).toEqual([]);
  });
  it("selects the last message before the candidate boundary even with tied timestamps", () => {
    const run = boardRun({
      head: "candidate-a",
      activity: [
        row(1, "message", "Earlier", 1),
        row(2, "message", "Recorded summary", 2),
        row(2, "status", "Host checks started", 3),
        row(2, "message", "Later message", 4),
      ],
    });
    const item = attention(run).find((item) => item.kind === "summary")!;
    expect(item).toMatchObject({
      detail: "Recorded summary",
      zone: "think",
      since: Date.parse(at(2)),
      state: "open",
    });
    expect(
      attention(run, new Set([item.id])).find((item) => item.kind === "summary")
        ?.state,
    ).toBe("done");
    expect(
      attention({ ...run, head: null }).some((item) => item.kind === "summary"),
    ).toBe(false);
  });
  it("Changes requires a head and exact reviewed head, never a local seen acknowledgement", () => {
    const run = boardRun({
      head: "candidate-a",
      reviewed_head: "candidate-old",
      activity: [
        row(1, "edit", "src/a.ts, src/b.ts"),
        row(2, "edit", "src/a.ts"),
      ],
    });
    const item = attention(run).find((item) => item.kind === "changes")!;
    expect(item).toMatchObject({
      level: "look",
      zone: "build",
      detail: "2 files",
      state: "open",
    });
    expect(
      attention(run, new Set([item.id])).find((item) => item.kind === "changes")
        ?.state,
    ).toBe("open");
    expect(
      attention({ ...run, reviewed_head: "candidate-a" }).find(
        (item) => item.kind === "changes",
      )?.state,
    ).toBe("done");
    expect(
      attention({ ...run, head: null }).some((item) => item.kind === "changes"),
    ).toBe(false);
  });
  it("Test steps uses the real handover and only accepted marks it done", () => {
    const run = boardRun({
      phase: "uat-ready",
      handover: handover(),
      activity: [row(20, "status", "Ready for owner UAT")],
    });
    const item = attention(run).find((item) => item.kind === "test")!;
    expect(item).toMatchObject({
      level: "act",
      zone: "test",
      detail: "1 scenarios",
      action: {
        label: "Test",
        run: "test",
        href: "#/delivery/test/handover-fixture",
      },
      since: epoch + 20_000,
    });
    expect(
      attention(run, new Set([item.id])).find((item) => item.kind === "test")
        ?.state,
    ).toBe("open");
    expect(
      attention({ ...run, handover: handover(true) }).find(
        (item) => item.kind === "test",
      )?.state,
    ).toBe("done");
  });
  it("does not fabricate a handover id or scenario count when UAT data is absent", () => {
    expect(
      attention(boardRun({ phase: "uat-ready" })).find(
        (item) => item.kind === "test",
      ),
    ).toMatchObject({
      title: "Test steps",
      state: "open",
      action: { run: "test" },
    });
    const item = attention(boardRun({ phase: "uat-ready" })).find(
      (item) => item.kind === "test",
    )!;
    expect(item.detail).toBeUndefined();
    expect(item.action.href).toBeUndefined();
  });
  it("Review diff requires actual risk and exact review head; domains/files are distinct", () => {
    const run = boardRun({
      phase: "uat-ready",
      head: "candidate-a",
      risk: {
        required: true,
        flagged: [
          { path: "src/a.ts", domains: ["money"] },
          { path: "migrations/a.sql", domains: ["schema", "money"] },
        ],
      },
    });
    const item = attention(run).find((item) => item.kind === "review")!;
    expect(item).toMatchObject({
      level: "act",
      zone: "test",
      detail: "2 files · money, schema",
      state: "open",
    });
    expect(
      attention({ ...run, reviewed_head: "candidate-a" }).find(
        (item) => item.kind === "review",
      )?.state,
    ).toBe("done");
    expect(
      attention({ ...run, risk: { required: false, flagged: [] } }).some(
        (item) => item.kind === "review",
      ),
    ).toBe(false);
    expect(
      attention({ ...run, phase: "building" }).some(
        (item) => item.kind === "review",
      ),
    ).toBe(false);
  });
  it("Run SQL deduplicates changed/flagged actual migration files, keeps all cards for the UI cap", () => {
    const run = boardRun({
      activity: [
        row(1, "edit", "migrations/a.sql, migrations/b.sql, src/readme.sql"),
        row(2, "command", "Get-Content migrations/read-only.sql"),
      ],
      risk: {
        required: true,
        flagged: [
          { path: "migrations/a.sql", domains: ["schema"] },
          { path: "migrations/c.sql", domains: ["schema"] },
          { path: "migrations/d.sql", domains: ["schema"] },
        ],
      },
    });
    const sql = attention(run).filter((item) => item.kind === "sql");
    expect(sql.map((item) => item.detail)).toEqual([
      "migrations/a.sql",
      "migrations/b.sql",
      "migrations/c.sql",
      "migrations/d.sql",
    ]);
    expect(sql).toHaveLength(4);
    expect(sql[0].since).toBe(epoch + 1000);
    expect(sql[2].since).toBeNull();
    const acknowledged = attention(run, new Set([sql[0].id])).find(
      (item) => item.id === sql[0].id,
    )!;
    expect(acknowledged.state).toBe("done");
    expect(run.risk?.required).toBe(true);
    expect(run.canShip).toBe(false);
  });
  it.each(["push-pending", "revert-push-pending"])(
    "Retry push appears for %s and disappears on resolved phase",
    (phase) => {
      const run = boardRun({ phase });
      expect(
        attention(run).find((item) => item.kind === "retry"),
      ).toMatchObject({
        level: "act",
        zone: "ship",
        title: "Retry push",
        action: { run: "retry" },
      });
      expect(
        attention({ ...run, phase: "shipped" }).some(
          (item) => item.kind === "retry",
        ),
      ).toBe(false);
      expect(
        attention({ ...run, phase: "reverted" }).some(
          (item) => item.kind === "retry",
        ),
      ).toBe(false);
    },
  );
  it("Failure uses the retained decoder, correct fault zone and real excerpt", () => {
    const run = boardRun({
      phase: "failed",
      error: "git commit: hook failed\nFAIL recorded hook",
      activity: [
        row(0, "status", "Native session started"),
        row(2, "status", "git commit: hook failed"),
      ],
    });
    expect(attention(run).find((item) => item.kind === "failed")).toMatchObject(
      {
        title: "Commit hook failed",
        zone: "seal",
        level: "act",
        action: { run: "new-attempt" },
      },
    );
    expect(
      attention(run).find((item) => item.kind === "failed")?.detail,
    ).toContain("FAIL recorded hook");
  });
  it("No signal opens at the actual stale boundary and clears with a new row", () => {
    const run = boardRun({
      activity: [
        row(0, "status", "Native session started"),
        row(1, "command", "git status"),
      ],
    });
    expect(
      attention(run, new Set(), 240).some((item) => item.kind === "silent"),
    ).toBe(false);
    expect(
      attention(run, new Set(), 241).find((item) => item.kind === "silent"),
    ).toMatchObject({
      title: "No signal",
      level: "act",
      detail: "4:00",
      zone: "explore",
      since: epoch + 1000,
    });
    expect(
      attention(
        {
          ...run,
          activity: [...run.activity, row(242, "message", "Recorded update")],
        },
        new Set(),
        243,
      ).some((item) => item.kind === "silent"),
    ).toBe(false);
  });
  it("retains a failed-phase act without fabricating missing error details", () => {
    const item = attention(boardRun({ phase: "failed", activity: [] })).find(
      (item) => item.kind === "failed",
    )!;
    expect(item).toMatchObject({
      title: "Failed",
      level: "act",
      state: "open",
      since: null,
    });
    expect(item.detail).toBeUndefined();
  });
  it("a generic supervisor row does not erase the last observed zone", () => {
    const run = boardRun({
      interrupted: true,
      activity: [
        row(1, "command", "Get-Content src/a.ts"),
        row(2, "status", "Recorded session observation"),
      ],
    });
    expect(attention(run).find((item) => item.kind === "lost")?.zone).toBe(
      "explore",
    );
  });
  it("Signal lost is look-only with no action, not an inferred failure", () => {
    const run = boardRun({
      interrupted: true,
      activity: [row(1, "edit", "src/a.ts")],
    });
    const item = attention(run, new Set(), 900).find(
      (item) => item.kind === "lost",
    )!;
    expect(item).toMatchObject({
      title: "Signal lost",
      level: "look",
      zone: "build",
      action: { run: "none" },
      since: epoch + 1000,
    });
    expect(
      attention(run, new Set(), 900).some(
        (item) => item.kind === "silent" || item.kind === "failed",
      ),
    ).toBe(false);
  });
  it("sorts open acts oldest first, then looks, then done without mutating input", () => {
    const items = attention(
      boardRun({
        phase: "uat-ready",
        work: { id: "R123", title: "Fixture", brief: "Brief" },
        activity: [
          row(1, "edit", "migrations/a.sql"),
          row(20, "status", "Ready for owner UAT"),
        ],
        handover: handover(),
      }),
    );
    expect(items.map((item) => item.kind)).toEqual(["sql", "test", "plan"]);
    const sql = items[0];
    const sorted = sortAttention([
      { ...sql, state: "done" },
      ...items.slice(1),
    ]);
    expect(sorted.map((item) => item.kind)).toEqual(["test", "plan", "sql"]);
    expect(sql.state).toBe("open");
  });
});
