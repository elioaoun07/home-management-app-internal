import { describe, it, expect, afterAll } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  sessionScorecard,
  deliveryScorecard,
  comparisons,
} from "../../scripts/os/scorecard.mjs";
import { processPanel } from "../../scripts/os/process.mjs";
import {
  evaluateTranscript,
  TRANSCRIPT_DETECTORS,
} from "../../scripts/os/transcript-eval.mjs";
import { readCodex } from "../../scripts/os/ingest/codex.mjs";
import { safety } from "../../scripts/os/ingest/signals.mjs";
import { ingest } from "../../scripts/os/ingest.mjs";
import { openStore } from "../../scripts/os/store.mjs";
import { markdown } from "../../scripts/os/report.mjs";
import { evaluate } from "../../scripts/os/eval.mjs";
const scratch = mkdtempSync(join(tmpdir(), "era-a4-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const changes = [
  {
    file: "src/lib/balance.ts",
    before: "export const balance=1;",
    after: "export const balance=2;",
    added: 1,
    removed: 1,
  },
  {
    file: "ERA Notes/10 - Project Management/Budget/Budget \u2014 Master Book.md",
    before: "",
    after: "BUD-1 verified",
    added: 1,
    removed: 0,
  },
];
const session = () => ({
  id: "money-no-skill",
  agent: "claude",
  coverage: "transcript",
  visibilityBug: false,
  tier: "CLAUDE_MID",
  effort: "medium",
  startedAt: "2026-11-01T10:00:00Z",
  endedAt: "2026-11-01T10:05:00Z",
  setup: { fingerprint: "sha256:fixture" },
  skills: [
    { name: "start-task", order: 0 },
    { name: "finish-task", order: 5 },
  ],
  reads: [
    {
      path: "ERA Notes/01 - Architecture/Feature Map/_index.md",
      order: 1,
      beforeFirstEdit: true,
    },
    {
      path: "ERA Notes/01 - Architecture/Feature Map/standalone/accounts-and-balance.md",
      order: 2,
      beforeFirstEdit: true,
    },
  ],
  timeline: [
    {
      tool: "Edit",
      edit: true,
      order: 3,
      completed: true,
      failed: false,
      signals: safety("Edit"),
    },
  ],
  usage: { input_tokens: 10, output_tokens: 2 },
  turns: 2,
});
const record = () => ({
  session: session(),
  events: [],
  checks: [] as import("../../scripts/os/types").Check[],
  verdicts: evaluate({ changes }).rules,
});
const at = (n: number) =>
  "2026-11-01T10:00:" + String(n).padStart(2, "0") + "Z";
function codexRows() {
  return [
    {
      timestamp: at(0),
      type: "session_meta",
      payload: {
        id: "codex-a4",
        cwd: "C:/repo",
        git: { branch: "main" },
        base_instructions: { text: "PRIVATE instructions" },
      },
    },
    {
      timestamp: at(1),
      type: "turn_context",
      payload: { turn_id: "turn1", model: "gpt-6.1-sol", effort: "high" },
    },
    {
      timestamp: at(2),
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        name: "exec",
        call_id: "load",
        input:
          'text(await tools.exec_command({cmd:"Get-Content -Encoding UTF8 \\".agents/skills/start-task/SKILL.md\\""}));'.replaceAll(
            '\\"',
            '"',
          ),
      },
    },
    {
      timestamp: at(3),
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: "load",
        output: "Script completed\nPRIVATE file text",
      },
    },
    {
      timestamp: at(4),
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        name: "apply_patch",
        call_id: "edit",
        input:
          "*** Begin Patch\n*** Update File: src/lib/balance.ts\n+PRIVATE code\n*** End Patch",
      },
    },
    {
      timestamp: at(5),
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: "edit",
        output: "Success",
      },
    },
    {
      timestamp: at(6),
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        call_id: "check",
        arguments: JSON.stringify({
          cmd: "pnpm typecheck",
          sandbox_permissions: "require_escalated",
        }),
      },
    },
    {
      timestamp: at(7),
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "check",
        output: JSON.stringify({
          exit_code: 0,
          output: "PRIVATE check output",
        }),
      },
    },
    {
      timestamp: at(8),
      type: "token_usage_record",
      payload: {
        session_id: "codex-a4",
        response_id: "r1",
        usage: {
          input_tokens: 100,
          cached_input_tokens: 60,
          cache_write_input_tokens: 0,
          output_tokens: 10,
          reasoning_output_tokens: 2,
        },
      },
    },
    {
      timestamp: at(8),
      type: "token_usage_record",
      payload: {
        session_id: "codex-a4",
        response_id: "r1",
        usage: {
          input_tokens: 100,
          cached_input_tokens: 60,
          cache_write_input_tokens: 0,
          output_tokens: 10,
          reasoning_output_tokens: 2,
        },
      },
    },
    {
      timestamp: at(9),
      type: "event_msg",
      payload: {
        type: "token_count",
        info: { total_token_usage: { input_tokens: 9999, output_tokens: 999 } },
      },
    },
    {
      timestamp: at(10),
      type: "event_msg",
      payload: { type: "task_complete" },
    },
  ];
}
function writeLog(rows: unknown[], name = "codex.jsonl") {
  const file = join(scratch, name);
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return file;
}
describe("A4 independent evidence panels", () => {
  it("fails money process despite green deterministic rules; loading skill repairs only process", () => {
    const r = record(),
      card = sessionScorecard(r, changes);
    expect(card.rules.verdict).toBe("pass");
    expect(card.process.verdict).toBe("fail");
    expect(
      card.process.facts.find((f) => f.name === "money-rules"),
    ).toMatchObject({ verdict: "fail", file: "src/lib/balance.ts" });
    expect(card.checks.verdict).toBe("unknown");
    expect(card.rules.facts).toHaveLength(29);
    r.session.skills.push({ name: "money-rules", order: 1 });
    expect(sessionScorecard(r, changes).process.verdict).toBe("pass");
  });
  it("requires start before edit, finish after final edit, and ordered Feature Map reads", () => {
    const s = session();
    s.skills = [
      { name: "start-task", order: 4 },
      { name: "finish-task", order: 1 },
      { name: "money-rules", order: 2 },
    ];
    s.reads.reverse();
    s.reads[0].order = 0;
    s.reads[1].order = 2;
    const panel = processPanel(s, changes);
    expect(
      panel.facts.filter((f) => f.verdict === "fail").map((f) => f.name),
    ).toEqual(
      expect.arrayContaining(["start-task", "finish-task", "read-first"]),
    );
  });
  it("does not manufacture passes without transcript or diff; notices deletion/import risks", () => {
    expect(
      processPanel({ ...session(), coverage: "supervisor" }, changes).verdict,
    ).toBe("unknown");
    expect(processPanel(session(), null).verdict).toBe("unknown");
    const panel = processPanel(session(), [
      {
        file: "src/features/transactions/hooks.ts",
        before: 'useMutation(); import {RRule} from "rrule";',
        after: null,
      },
    ]);
    expect(panel.facts.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        "money-rules",
        "recurrence-safety",
        "cache-invalidation",
      ]),
    );
  });
  it("keeps advisories nonblocking and transcript observations separate from host checks", () => {
    const r = record();
    r.checks = [
      {
        schema: "os/check@1",
        id: "claimed",
        name: "typecheck",
        source: "transcript",
        exitCode: 0,
      },
    ];
    const card = sessionScorecard(r, changes);
    expect(card.checks.facts.find((c) => c.name === "typecheck")?.verdict).toBe(
      "unknown",
    );
    const advisory = evaluate({
      changes: [
        {
          file: "src/components/ItemRow.tsx",
          before: null,
          after: '<div className="text-red-400" />;',
        },
      ],
    });
    expect(advisory.rules.find((r) => r.rule === "HR-3")?.verdict).toBe("fail");
    expect(advisory.verdict).toBe("fail"); // PM trace is a checked failure
    expect(
      evaluate({
        changes: [
          {
            file: "src/components/ItemRow.tsx",
            before: null,
            after: '<div className="text-red-400" />;',
          },
          changes[1],
        ],
      }).verdict,
    ).toBe("pass");
  });
  it("measures scope by path segments, preserves missing counters and counts failed-check retries", () => {
    const r = record();
    r.checks = [
      { id: "a", name: "test", source: "supervisor", exitCode: 1 },
      { id: "b", name: "test", source: "supervisor", exitCode: 0 },
    ];
    const card = sessionScorecard(r, changes, {
      touches: ["src/lib/bal"],
      module: "accounts",
    });
    expect(card.scope.outsideTouches).toContain("src/lib/balance.ts");
    expect(card.scope.added).toBe(2);
    expect(card.autonomy.checkRetries).toBe(1);
    expect(card.cost.wallMs).toBe(300000);
  });
});
describe("A4 transcript detectors and privacy", () => {
  it("load-gates every process detector with fail/pass/n-a fixtures", () => {
    for (const [id, d] of TRANSCRIPT_DETECTORS) {
      const rows = JSON.parse(
        readFileSync(
          resolve("tests/os/fixtures/detectors", id + ".json"),
          "utf8",
        ),
      );
      for (const f of rows) expect(d.detect(f)?.verdict).toBe(f.expected);
    }
  });
  it("flags forbidden tool attempts, direct paid calls, and RLS read ordering", () => {
    const s = session();
    s.timeline[0].signals = safety("mcp__supabase__execute_sql", "");
    expect(
      evaluateTranscript(s, changes).find((r) => r.rule === "HR-26")?.verdict,
    ).toBe("fail");
    expect(
      safety("Bash", "curl https://api.anthropic.com/v1/messages").paidApi,
    ).toBe(true);
    expect(safety("Bash", "pnpm vitest run tests/os").paidApi).toBe(false);
    s.visibilityBug = true;
    s.reads = [
      { path: "src/app/api/cards/route.ts", order: 1, beforeFirstEdit: true },
      { path: "migrations/db-state.json", order: 2, beforeFirstEdit: true },
    ];
    expect(
      evaluateTranscript(s, changes).find((r) => r.rule === "HR-27")?.verdict,
    ).toBe("fail");
  });
  it("reads native and Work Codex calls, deduplicates tokens and never stores private bodies", async () => {
    const rows = codexRows();
    // Real custom exec input is JavaScript, not an argument object.
    rows[2].payload.input =
      'text(await tools.exec_command({cmd:"Get-Content .agents/skills/start-task/SKILL.md"}));';
    const file = writeLog(rows),
      before = readFileSync(file),
      facts = await readCodex(file);
    expect(facts.model).toBe("gpt-6.1-sol");
    expect(facts.effort).toBe("high");
    expect(facts.skills.map((s) => s.name)).toEqual(["start-task"]);
    expect(facts.reads[0].beforeFirstEdit).toBe(true);
    expect(facts.usage.input_tokens).toBe(100);
    expect(facts.usage.output_tokens).toBe(10);
    expect(facts.checks[0]).toMatchObject({
      source: "transcript",
      exitCode: 0,
    });
    expect(facts.timeline[2].signals.approval).toBe(true);
    expect(JSON.stringify(facts)).not.toMatch(/PRIVATE|9999|base_instructions/);
    expect(readFileSync(file).equals(before)).toBe(true);
  });
  it("rejects wrong identity, unsupported logs and partial JSON without persistence", async () => {
    const file = writeLog(codexRows(), "bad.jsonl");
    await expect(readCodex(file, "different")).rejects.toThrow("identity");
    writeFileSync(file, '{"type":"other"}\n');
    await expect(readCodex(file)).rejects.toThrow("missing session_meta");
    writeFileSync(file, "{");
    await expect(readCodex(file)).rejects.toThrow("no rows changed");
  });
  it("imports Codex durably and exports all six panels via the real CLI", async () => {
    const root = join(scratch, "git");
    mkdirSync(root);
    const git = (...args: string[]) => {
      const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
      return r.stdout.trim();
    };
    git("init", "--quiet");
    writeFileSync(join(root, "README.md"), "fixture");
    git("add", ".");
    git(
      "-c",
      "user.name=A4",
      "-c",
      "user.email=a4@example.invalid",
      "-c",
      "core.hooksPath=.no-hooks",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    );
    const head = git("rev-parse", "HEAD");
    const rows = codexRows();
    rows[2].payload.input =
      'text(await tools.exec_command({cmd:"Get-Content .agents/skills/start-task/SKILL.md"}));';
    const transcript = writeLog(rows, "durable.jsonl");
    for (let i = 0; i < 2; i++)
      await ingest({
        root,
        transcript,
        agent: "codex",
        range: head + ".." + head,
      });
    const store = openStore(root, { readOnly: true });
    try {
      expect(store.list()).toHaveLength(1);
      const record = store.get("codex-a4");
      expect(record.session.scorecard.schema).toBe("os/scorecard@1");
      expect(() =>
        store.put({
          ...record,
          session: {
            ...record.session,
            scorecard: { ...record.session.scorecard, version: 99 },
          },
        }),
      ).toThrow("Unsupported scorecard version");
      const output = markdown(record);
      for (const name of [
        "Rules",
        "Checks",
        "Process",
        "Scope",
        "Autonomy",
        "Cost",
      ])
        expect(output).toContain("### " + name);
      expect(output).not.toMatch(/PRIVATE/);
    } finally {
      store.close();
    }
    const cli = spawnSync(
      process.execPath,
      [resolve("scripts/os/report.mjs"), "codex-a4"],
      { cwd: root, encoding: "utf8" },
    );
    expect(cli.status, cli.stderr).toBe(0);
    expect(cli.stdout).toContain("## Scorecard");
  }, 60_000);
});
describe("A4 delivery outcomes and comparable cohorts", () => {
  it("deduplicates sessions, counts rework after done, keeps UAT, restricts escapes to thirty days and records reverts", () => {
    const first = {
      ...session(),
      id: "one",
      doneAt: "2026-11-01T10:05:00Z",
      changeFacts: [{ file: "a", added: 2, removed: 1 }],
    };
    const second = {
      ...session(),
      id: "two",
      startedAt: "2026-11-02T10:00:00Z",
      endedAt: "2026-11-02T10:05:00Z",
      changeFacts: [
        { file: "a", added: 3, removed: 2 },
        { file: "b", added: 5, removed: 0 },
      ],
    };
    const card = deliveryScorecard({
      itemId: "BUD-1",
      sessions: [first, first, second],
      shippedAt: "2026-11-03T10:00:00Z",
      now: "2026-12-05T10:00:00Z",
      followups: [
        {
          id: "BUD-2",
          kind: "bug",
          filedAt: "2026-11-04",
          references: ["BUD-1"],
        },
        {
          id: "BUD-3",
          kind: "bug",
          filedAt: "2026-12-05",
          references: ["BUD-1"],
        },
        {
          id: "BUD-4",
          kind: "feature",
          filedAt: "2026-11-04",
          references: ["BUD-1"],
        },
      ],
      reverts: [{ itemId: "BUD-1", commit: "abc", at: "2026-11-05" }],
      uat: [
        {
          handover_id: "u",
          revision: 1,
          acceptance: { state: "needs-changes" },
          scenarios: [{ id: "s", result: "fail" }],
        },
      ],
    });
    expect(card.n).toBe(2);
    expect(card.sessionsToShip).toBe(2);
    expect(card.reworkLinesApprox).toBe(5);
    expect(card.escapes?.map((e) => e.id)).toEqual(["BUD-2"]);
    expect(card.reverted).toBe(true);
    expect(card.uat[0].scenarios?.[0].result).toBe("fail");
    expect(card.escapeWindowComplete).toBe(true);
    expect(card.cost.usage.input_tokens).toBe(20);
  });
  it("leaves unobserved escapes, owner time, reverts and rework unknown", () => {
    const card = deliveryScorecard({ itemId: "R1", sessions: [session()] });
    expect(card.reverted).toBeNull();
    expect(card.escapes).toBeNull();
    expect(card.ownerMinutesApprox).toBeNull();
    expect(card.reworkLinesApprox).toBeNull();
    expect(card.sessionsToShip).toBeNull();
  });
  it("prints n and raw rows, never ranks under ten, and separates effort/item class/setup changes", () => {
    const r = record(),
      scorecard = sessionScorecard(r, changes);
    const rows = Array.from({ length: 9 }, (_, i) => ({
      id: String(i),
      itemClass: { kind: "bug", risk: true, effort: "S" },
      scorecard,
    }));
    let groups = comparisons(rows);
    expect(groups[0].n).toBe(9);
    expect(groups[0].rates).toBeNull();
    expect(groups[0].ranking).toBeNull();
    expect(groups[0].raw).toHaveLength(9);
    rows.push({
      ...rows[0],
      id: "10",
      scorecard: { ...scorecard, setup: "sha256:other" },
    });
    groups = comparisons(rows);
    expect(groups[0].n).toBe(10);
    expect(groups[0].rates).not.toBeNull();
    expect(groups[0].setupChanged).toBe(true);
    rows.push({
      ...rows[0],
      id: "11",
      scorecard: { ...scorecard, effort: "high" },
    });
    expect(comparisons(rows)).toHaveLength(2);
  });
});

describe("A4 metadata and additional detector boundaries", () => {
  it("reads canonical R IDs, effort, tier aliases, and archived bug criteria", async () => {
    const { pmFacts, tierAlias } = await import("../../scripts/os/item.mjs");
    const root = join(scratch, "metadata"),
      pm = join(root, "ERA Notes/10 - Project Management");
    mkdirSync(join(pm, "PM Tooling"), { recursive: true });
    mkdirSync(join(pm, "_Archive/Shipped"), { recursive: true });
    writeFileSync(
      join(pm, "PM Tooling/4 - Checklist.md"),
      "- [ ] **R96** Score sessions _(friction - M)_\n",
    );
    writeFileSync(
      join(pm, "PM Tooling/PM Tooling \u2014 Master Book.md"),
      "### R96\n**Kind:** feature\n**Touches:** \x60scripts/\x60\n",
    );
    writeFileSync(
      join(pm, "_Archive/Shipped/PM Tooling.md"),
      "### R100\n**Kind:** bug\nFiled 2026-11-12\n- **Acceptance:** R96 no longer drops the recorded check.\n",
    );
    writeFileSync(
      join(root, "ERA Notes/Model-Registry.md"),
      "| \x60CODEX_MID\x60 | Codex | Sol | \x60gpt-6.1-sol\x60 | high |\n",
    );
    const facts = pmFacts(root);
    expect(facts.find((i) => i.id === "R96")).toMatchObject({
      kind: "feature",
      effort: "M",
      touches: ["scripts/"],
    });
    expect(facts.find((i) => i.id === "R100")?.references).toEqual(["R96"]);
    expect(tierAlias(root, "gpt-6.1-sol")).toBe("CODEX_MID");
    expect(tierAlias(root, "unknown")).toBeNull();
  });
  it("flags protected deletion and binary edits, and ignores comments posing as conflict handling", () => {
    const protectedFile = "src/components/ui/button.tsx";
    for (const change of [
      { file: protectedFile, before: "old", after: null },
      { file: protectedFile, before: "", after: "", status: "M" },
    ])
      expect(
        evaluate({ changes: [change] }).rules.find((r) => r.rule === "HR-11")
          ?.verdict,
      ).toBe("fail");
    const report = evaluate({
      changes: [
        {
          file: "src/app/api/cards/route.ts",
          before: null,
          after:
            'db.insert({}); const code="23505"; const options={status:409};',
        },
      ],
    });
    expect(report.rules.find((r) => r.rule === "HR-9")?.verdict).toBe("fail");
    const policy = evaluate({
      changes: [
        {
          file: "migrations/2026-11-11_child.sql",
          before: null,
          after:
            "CREATE POLICY p ON public.item_alerts USING (EXISTS (SELECT 1 FROM items));",
        },
      ],
    });
    expect(policy.rules.find((r) => r.rule === "HR-20")?.verdict).toBe("fail");
  });
});

describe("A4 line rework evidence", () => {
  it("distinguishes changing delivered lines from unrelated edits in the same file", async () => {
    const { reworkLines } = await import("../../scripts/os/rework.mjs");
    const first = {
      startedAt: at(0),
      base: "a",
      head: "b",
      changeFacts: [
        {
          file: "a.ts",
          hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2 }],
        },
      ],
    };
    const unrelated = {
      startedAt: at(20),
      base: "b",
      head: "c",
      changeFacts: [
        {
          file: "a.ts",
          hunks: [{ oldStart: 100, oldLines: 1, newStart: 100, newLines: 1 }],
        },
      ],
    };
    const rework = {
      ...unrelated,
      changeFacts: [
        {
          file: "a.ts",
          hunks: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 3 }],
        },
      ],
    };
    expect(reworkLines([first, unrelated], at(10))).toBe(0);
    expect(reworkLines([first, rework], at(10))).toBe(5);
    expect(
      reworkLines([first, { ...rework, base: "other" }], at(10)),
    ).toBeNull();
  });
});
