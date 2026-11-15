import { describe, expect, it } from "vitest";
import { localRunActivity } from "../../scripts/pm/app/localRunActivityModel";

const at = "2026-11-15T10:00:00Z";
const base = {
  phase: "building",
  interrupted: false,
  activity: [] as {
    at: string;
    summary: string | null;
    kind?: string;
    seq?: number;
    job_id?: string;
  }[],
  checks: [] as { name: string; exit: number | null; error: string | null }[],
};

describe("Local delivery activity projection", () => {
  it("uses real Claude tool requests without inventing filenames or successful edits", () => {
    const view = localRunActivity({
      ...base,
      activity: [
        { at, kind: "tool", summary: "Read", seq: 0, job_id: "native" },
        { at, kind: "tool", summary: "Edit", seq: 1, job_id: "native" },
      ],
    });
    expect(view.station).toBe("forge");
    expect(view.label).toBe("Edit requested");
    expect(view.detail).toBeNull();
    expect(view.events.map((event) => event.label)).toEqual([
      "Edit requested",
      "Read requested",
    ]);
    expect(view.counts).toEqual({
      reads: 1,
      edits: 1,
      commands: 0,
      checks: 0,
      events: 2,
    });
    expect(view.active).toBe(true);
  });

  it("preserves observed Codex paths and commands, with test commands sent to the lab", () => {
    const view = localRunActivity({
      ...base,
      activity: [
        { at, kind: "edit", summary: "src/features/example.ts" },
        {
          at,
          kind: "command",
          summary: "pnpm vitest run tests/example.test.ts",
        },
      ],
    });
    expect(view.station).toBe("lab");
    expect(view.label).toBe("Command completed");
    expect(view.detail).toBe("pnpm vitest run tests/example.test.ts");
    expect(view.events[1].detail).toBe("src/features/example.ts");
    expect(view.counts.commands).toBe(1);
    expect(view.counts.checks).toBe(0);
  });

  it("does not turn assistant prose into evidence of a read, edit, test or private thinking", () => {
    const view = localRunActivity({
      ...base,
      activity: [
        {
          at,
          kind: "message",
          summary: "I will read src/a.ts, edit it and run pnpm test",
        },
        { at, kind: "message", summary: "Read" },
      ],
    });
    expect(view.events.every((event) => event.kind === "message")).toBe(true);
    expect(view.station).toBe("forge");
    expect(view.label).toBe("Building");
    expect(
      view.counts.reads +
        view.counts.edits +
        view.counts.commands +
        view.counts.checks,
    ).toBe(0);
  });

  it("keeps durable event identities when the retained activity window advances", () => {
    const recorded = [
      { at, kind: "tool", summary: "Read", seq: 14, job_id: "native" },
      { at, kind: "tool", summary: "Edit", seq: 15, job_id: "native" },
    ];
    const first = localRunActivity({ ...base, activity: recorded });
    const next = localRunActivity({ ...base, activity: recorded.slice(1) });
    expect(first.events[0].id).toBe("native:15");
    expect(next.events[0].id).toBe(first.events[0].id);
  });

  it("lets supervisor milestones override stale native activity and counts only confirmed checks", () => {
    const view = localRunActivity({
      ...base,
      phase: "checking",
      activity: [
        { at, kind: "tool", summary: "Read" },
        { at, kind: "event", summary: "Host checks started" },
        { at, kind: "event", summary: "typecheck: 0" },
        { at, kind: "event", summary: "lint: 1" },
        { at, kind: "event", summary: "test: null" },
        { at, kind: "event", summary: "pm:lint: 0" },
      ],
      checks: [
        { name: "typecheck", exit: 0, error: null },
        { name: "lint", exit: 1, error: null },
        { name: "test", exit: null, error: null },
        { name: "pm:lint", exit: 0, error: "Host timed out" },
      ],
    });
    expect(view.station).toBe("lab");
    expect(view.label).toBe("Verifying");
    expect(view.counts.checks).toBe(1);
    expect(view.events.slice(0, 4).map((event) => event.label)).toEqual([
      "Check inconclusive",
      "Check inconclusive",
      "Check failed",
      "Check passed",
    ]);
  });

  it("stops motion for failed, cancelled and interrupted sessions without claiming completion", () => {
    for (const phase of [
      "failed",
      "cancelled",
      "shipped",
      "reverted",
      "push-pending",
    ]) {
      expect(localRunActivity({ ...base, phase }).active).toBe(false);
    }
    const interrupted = localRunActivity({
      ...base,
      interrupted: true,
      activity: [{ at, kind: "tool", summary: "Read" }],
    });
    expect(interrupted.active).toBe(false);
    expect(interrupted.label).toBe("Session interrupted");
    expect(localRunActivity({ ...base, phase: "uat-ready" })).toMatchObject({
      station: "review",
      active: false,
      waiting: true,
      label: "Ready to test",
    });
  });

  it("handles an empty preparing session and hides native stack traces in activity cards", () => {
    expect(localRunActivity({ ...base, phase: "preparing" })).toMatchObject({
      station: "launch",
      label: "Preparing workspace",
      latestAt: null,
      events: [],
    });
    const error = "native session exited 1: a long sensitive stack trace";
    const view = localRunActivity({
      ...base,
      phase: "failed",
      error,
      activity: [{ at, summary: error }],
    });
    expect(view.events[0].summary).toBe("Session failed · see error details");
    expect(view.events[0].detail).toBeNull();
  });
});
