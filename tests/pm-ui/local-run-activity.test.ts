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
  it.each(["message", "command", "tool"] as const)(
    "keeps native %s identity when quoting a supervisor failure",
    (kind) => {
      const error = "git commit: recorded hook failed";
      for (const summary of [
        error,
        "native session exited 1: quoted failure",
      ]) {
        const view = localRunActivity({
          ...base,
          phase: "failed",
          error,
          activity: [{ at, kind, summary }],
        });
        expect(view.events[0].kind).toBe(kind === "tool" ? "event" : kind);
        expect(view.events[0].summary).toBe(summary);
        if (kind === "tool")
          expect(view.events[0].label).toBe("Tool requested");
      }
    },
  );
  it.each(["status", "event", undefined, null])(
    "retains supervisor failure evidence for legacy kind %s",
    (kind) => {
      const error = "git commit: recorded hook failed";
      for (const summary of [
        error,
        "native session exited 1: supervisor failure",
      ]) {
        const view = localRunActivity({
          ...base,
          phase: "failed",
          error,
          activity: [{ at, kind, summary }],
        });
        expect(view.events[0]).toMatchObject({
          kind: "failure",
          label: "Session failed",
          detail: null,
          summary: "Session failed · see error details",
        });
      }
    },
  );
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
    expect(view.label).toBe("Ran pnpm vitest run tests/example.test.ts");
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

  it.each([
    '"C:\\windows\\system32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command \'Get-Content -LiteralPath "C:\\work\\era\\src\\app\\api\\route.ts"\'',
    "/bin/sh -lc 'cat /work/era/src/app/api/route.ts'",
    "bash -lc 'cat /work/era/src/app/api/route.ts'",
    'cmd /c "type C:\\work\\era\\src\\app\\api\\route.ts"',
  ])("unwraps a recorded read shell: %s", (summary) => {
    const workspace = summary.includes("/work/")
      ? "/work/era"
      : "C:\\work\\era";
    const view = localRunActivity({
      ...base,
      workspace,
      activity: [{ at, kind: "command", summary }],
    });
    expect(view.counts.reads).toBe(1);
    expect(view.counts.commands).toBe(0);
    expect(view.events[0]).toMatchObject({
      station: "source",
      label: "Read route.ts",
      paths: ["src/app/api/route.ts"],
      detail: "src/app/api/route.ts",
    });
    expect(view.events[0].command).not.toMatch(
      /powershell|cmd \/c|bash -lc|sh -lc/u,
    );
  });

  it.each([
    "Get-Content a.ts",
    "gc a.ts",
    "cat a.ts",
    "type a.ts",
    "rg value a.ts",
    "grep value a.ts",
    "Select-String -Pattern value -Path a.ts",
    "ls src",
    "dir src",
    "Get-ChildItem src",
    "Get-Item a.ts",
    "sed -n '1,20p' a.ts",
    "head a.ts",
    "tail a.ts",
    "find src",
    "git diff a.ts",
    "git status",
    "git log",
    "git show HEAD:a.ts",
  ])("classifies leading read verb %s at Source", (summary) => {
    const event = localRunActivity({
      ...base,
      activity: [{ at, kind: "command", summary }],
    }).events[0];
    expect(event.kind).toBe("read");
    expect(event.station).toBe("source");
  });

  it.each([
    "pnpm typecheck",
    "pnpm exec eslint scripts",
    "tsc --noEmit",
    "vitest run",
    "eslint .",
    "npm run test",
  ])("sends check command %s to Lab without granting a seal", (summary) => {
    const view = localRunActivity({
      ...base,
      activity: [{ at, kind: "command", summary }],
    });
    expect(view.events[0]).toMatchObject({ kind: "command", station: "lab" });
    expect(view.counts.checks).toBe(0);
  });

  it("splits comma-joined edits, preserves their row identity and carries recorded subagents", () => {
    const view = localRunActivity({
      ...base,
      workspace: "C:\\work\\era",
      activity: [
        {
          at,
          kind: "edit",
          summary: "C:\\work\\era\\src\\a.ts, C:/work/era/ERA Notes/Plan.md",
          seq: 8,
          job_id: "job",
          agent_json: JSON.stringify({
            role: "subagent",
            id: "child-1",
            executor: "claude",
          }),
        },
      ],
    });
    expect(view.events[0]).toMatchObject({
      id: "job:8",
      paths: ["src/a.ts", "ERA Notes/Plan.md"],
      label: "Edited a.ts",
      agent: { role: "subagent", id: "child-1" },
    });
    expect(view.counts.edits).toBe(1);
  });

  it("labels the observed search query and avoids shell tests becoming verification", () => {
    const view = localRunActivity({
      ...base,
      activity: [
        { at, kind: "command", summary: "rg -n guest_portal_tags src/app/api" },
        { at, kind: "command", summary: "test -f package.json" },
      ],
    });
    expect(view.events[1].label).toBe("Searched guest_portal_tags");
    expect(view.events[0].station).toBe("forge");
    expect(view.events[1].paths).toEqual([]);
  });

  it("keeps shell details repo-relative and skips search option values", () => {
    const view = localRunActivity({
      ...base,
      workspace: "C:\\work\\era",
      activity: [
        {
          at,
          kind: "command",
          summary:
            'rg --glob "*.ts" guest_portal_tags "C:\\work\\era\\src\\a.ts"',
        },
        { at, kind: "command", summary: 'git add "C:/work/era/src/a.ts"' },
      ],
    });
    expect(view.events[1]).toMatchObject({
      label: "Searched guest_portal_tags",
      paths: ["src/a.ts"],
    });
    expect(view.events[0].label).toBe('Ran git add "src/a.ts"');
    expect(view.events.every((event) => !event.detail?.includes("work"))).toBe(
      true,
    );
  });

  it("does not turn read limits or shell globs into filenames", () => {
    const view = localRunActivity({
      ...base,
      activity: [
        { at, kind: "command", summary: "head -n 20 src/a.ts" },
        { at, kind: "command", summary: "rg -e value src/b.ts" },
        { at, kind: "command", summary: 'ls "src/*.ts"' },
      ],
    });
    expect(view.events.map((event) => event.paths)).toEqual([
      [],
      ["src/b.ts"],
      ["src/a.ts"],
    ]);
  });

  it("recognises the stored prefix of a long supervisor failure without leaking hook output", () => {
    const error = `git commit: \u001b[31m${"long hook output ".repeat(100)}`;
    const view = localRunActivity({
      ...base,
      phase: "failed",
      error,
      activity: [{ at, kind: "status", summary: error.slice(0, 400) }],
    });
    expect(view.events[0]).toMatchObject({
      kind: "failure",
      label: "Session failed",
      detail: null,
      summary: "Session failed · see error details",
    });
    expect(view.counts.commands).toBe(0);
  });

  it("takes an explicit PowerShell search pattern even when the path comes first", () => {
    const view = localRunActivity({
      ...base,
      activity: [
        {
          at,
          kind: "command",
          summary: "Select-String -Path src/a.ts -Pattern guest_portal_tags",
        },
      ],
    });
    expect(view.events[0]).toMatchObject({
      paths: ["src/a.ts"],
      label: "Searched guest_portal_tags",
    });
  });
});

describe("Capped Local activity captures", () => {
  it.each([240, 400])(
    "drops the trailing fragment from an edit capture at the %i-character cap",
    (cap) => {
      const paths = [
        "src/app/api/allergies/route.ts",
        "src/app/api/drinks/route.ts",
        "src/app/g/drinks-admin/page.tsx",
        "ERA Notes/Guest Portal.md",
        ".delivery-handover.json",
      ];
      const prefix = `${paths.join(", ")}, C:\\work\\era\\`;
      const summary = prefix + "x".repeat(cap - prefix.length - 7) + "\\ERA No";
      expect(summary).toHaveLength(cap);
      const view = localRunActivity({
        ...base,
        workspace: "C:\\work\\era",
        activity: [{ at, kind: "edit", summary }],
      });
      expect(view.events[0].paths).toEqual(paths);
      expect(new Set(view.events.flatMap((event) => event.paths)).size).toBe(5);
    },
  );

  it.each([240, 400])(
    "never turns one capped incomplete path into a filename (%i characters)",
    (cap) => {
      const commandPrefix = 'Get-Content -LiteralPath "C:\\work\\era\\';
      const summary =
        commandPrefix + "x".repeat(cap - commandPrefix.length - 7) + "\\ERA No";
      const view = localRunActivity({
        ...base,
        workspace: "C:\\work\\era",
        activity: [{ at, kind: "command", summary }],
      });
      expect(summary).toHaveLength(cap);
      expect(view.events[0]).toMatchObject({
        kind: "read",
        station: "source",
        paths: [],
        label: "Read",
      });
      const edit = localRunActivity({
        ...base,
        activity: [{ at, kind: "edit", summary: "x".repeat(cap) }],
      });
      expect(edit.events[0].paths).toEqual([]);
    },
  );

  it.each(["'", '"'])(
    "classifies specimen-shaped capped Get-Content, rg and git diff after a missing %s shell quote",
    (quote) => {
      const wrapper =
        '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command ';
      const commands = [
        'Get-Content -LiteralPath "C:\\work\\era\\src\\a.ts"',
        'rg -n guest_portal_tags "C:\\work\\era\\src\\b.ts"',
        "git diff --stat",
      ];
      const activity = commands.map((command, seq) => {
        const prefix = `${wrapper}${quote}${command}; #`;
        return {
          at,
          kind: "command",
          seq,
          job_id: "specimen",
          summary: prefix + "x".repeat(240 - prefix.length),
        };
      });
      const view = localRunActivity({
        ...base,
        workspace: "C:\\work\\era",
        activity,
      });
      expect(activity.every((row) => row.summary.length === 240)).toBe(true);
      expect(view.counts).toMatchObject({ reads: 3, commands: 0 });
      expect(view.events.every((event) => event.station === "source")).toBe(
        true,
      );
      expect(view.events.flatMap((event) => event.paths)).toEqual([
        "src/b.ts",
        "src/a.ts",
      ]);
    },
  );
});
