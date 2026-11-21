import { afterAll, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  appendEvent,
  eventFile,
  shellProgram,
} from "../../scripts/os/hook.mjs";
import { ingest } from "../../scripts/os/ingest.mjs";
import { readClaude } from "../../scripts/os/ingest/claude.mjs";
import { readCodex } from "../../scripts/os/ingest/codex.mjs";
import { openStore } from "../../scripts/os/store.mjs";
import { markdown } from "../../scripts/os/report.mjs";

const root = resolve("."),
  scratch = mkdtempSync(join(tmpdir(), "era-a3 with spaces-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
let sequence = 0;
function fixture() {
  const dir = join(scratch, `session ${sequence++}`);
  mkdirSync(dir);
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  git("init", "--quiet");
  writeFileSync(join(dir, "README.md"), "A3 fixture\n");
  git("add", ".");
  git(
    "-c",
    "user.name=A3",
    "-c",
    "user.email=a3@example.invalid",
    "-c",
    "core.hooksPath=.no-hooks",
    "-c",
    "commit.gpgSign=false",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  return { dir, head: git("rev-parse", "HEAD") };
}
function run(
  dir: string,
  event: string,
  input: string | Buffer,
  program: string,
  ...args: string[]
) {
  return runAgent("claude", dir, event, input, program, ...args);
}
function runAgent(
  agent: "claude" | "codex",
  dir: string,
  event: string,
  input: string | Buffer,
  program: string,
  ...args: string[]
) {
  return spawnSync(
    process.execPath,
    [
      join(root, "scripts/os/hook.mjs"),
      "fixture-hook",
      event,
      "--",
      program,
      ...args,
    ],
    {
      cwd: scratch,
      input,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, OS_AGENT: agent },
      maxBuffer: 4 * 1024 * 1024,
    },
  );
}
const at = (second: number) =>
  `2026-11-06T12:00:${String(second).padStart(2, "0")}.000Z`;
function transcript(dir: string) {
  // Sanitized recorded Claude shape: streaming messages reuse message.id;
  // user records hold tool_result blocks; Stop summaries lack exit status.
  const usage = {
    input_tokens: 3,
    cache_read_input_tokens: 20,
    cache_creation_input_tokens: 10,
    output_tokens: 5,
  };
  const rows = [
    {
      type: "user",
      uuid: "u",
      timestamp: at(0),
      sessionId: "real-shape",
      cwd: dir,
      gitBranch: "main",
      message: { content: "PRIVATE PROMPT api_key=never-store-prompt" },
    },
    {
      type: "assistant",
      uuid: "a1",
      timestamp: at(1),
      sessionId: "real-shape",
      message: {
        id: "msg1",
        model: "claude-recorded",
        usage,
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "Skill",
            input: { skill: "start-task", args: "PRIVATE ARGS" },
          },
        ],
      },
    },
    {
      type: "assistant",
      uuid: "a2",
      timestamp: at(1),
      sessionId: "real-shape",
      message: { id: "msg1", usage, content: [] },
    },
    {
      type: "user",
      uuid: "r1",
      timestamp: at(2),
      sessionId: "real-shape",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: "PRIVATE SKILL TEXT",
          },
        ],
      },
    },
    {
      type: "assistant",
      uuid: "a3",
      timestamp: at(3),
      sessionId: "real-shape",
      message: {
        id: "msg2",
        usage,
        content: [
          {
            type: "tool_use",
            id: "t2",
            name: "Bash",
            input: {
              command:
                "cat .claude/skills/finish-task/SKILL.md; echo api_key=private-shell-key",
            },
          },
          {
            type: "tool_use",
            id: "t3",
            name: "Read",
            input: { file_path: "ERA Notes/Architecture.md" },
          },
        ],
      },
    },
    {
      type: "user",
      uuid: "r2",
      timestamp: at(4),
      sessionId: "real-shape",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "t2",
            content: "PRIVATE FILE TEXT",
          },
          {
            type: "tool_result",
            tool_use_id: "t3",
            content: "PRIVATE VAULT TEXT",
          },
        ],
      },
    },
    {
      type: "assistant",
      uuid: "a4",
      timestamp: at(5),
      sessionId: "real-shape",
      message: {
        id: "msg3",
        content: [
          {
            type: "tool_use",
            id: "t4",
            name: "Edit",
            input: { file_path: "src/Card.tsx", new_string: "PRIVATE CODE" },
          },
          {
            type: "tool_use",
            id: "t5",
            name: "Bash",
            input: { command: "pnpm typecheck" },
          },
        ],
      },
    },
    {
      type: "user",
      uuid: "r3",
      timestamp: at(6),
      sessionId: "real-shape",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "t4", content: "ok" },
          {
            type: "tool_result",
            tool_use_id: "t5",
            content: "Exit code: 0\nPRIVATE CHECK OUTPUT",
          },
        ],
      },
    },
    {
      type: "system",
      uuid: "hook",
      timestamp: at(7),
      sessionId: "real-shape",
      subtype: "stop_hook_summary",
      hookInfos: [
        { command: "bash .claude/hooks/check-pm-update.sh", durationMs: 77 },
      ],
      preventedContinuation: false,
    },
  ];
  const file = join(dir, "transcript.jsonl");
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  return file;
}

describe("A3 hook passthrough", () => {
  it("auto-ingests native Codex lifecycle payloads and repeated Stop updates one session", () => {
    const { dir, head } = fixture(),
      file = join(dir, "rollout.jsonl"),
      id = "codex-automatic";
    const rows = [
      {
        type: "session_meta",
        timestamp: at(0),
        payload: { id, cwd: dir, git: { branch: "main" } },
      },
      {
        type: "turn_context",
        timestamp: at(1),
        payload: { turn_id: "turn-1", model: "gpt-recorded", effort: "high" },
      },
      {
        type: "response_item",
        timestamp: at(2),
        payload: {
          type: "message",
          role: "assistant",
          id: "response-1",
          content: [],
        },
      },
      {
        type: "event_msg",
        timestamp: at(3),
        payload: { type: "task_complete" },
      },
    ];
    writeFileSync(
      file,
      rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    );
    writeFileSync(join(dir, ".git/info/exclude"), ".os/\nrollout.jsonl\n");
    const input = JSON.stringify({
      session_id: id,
      transcript_path: file,
      cwd: dir,
      hook_event_name: "Stop",
    });
    // A Stop without an approved/fired SessionStart cannot invent its base.
    const incompleteId = "codex-no-start",
      incompleteFile = join(dir, "incomplete.jsonl");
    writeFileSync(
      incompleteFile,
      rows
        .map((row) =>
          JSON.stringify(
            row.type === "session_meta"
              ? { ...row, payload: { ...row.payload, id: incompleteId } }
              : row,
          ),
        )
        .join("\n") + "\n",
    );
    expect(
      runAgent(
        "codex",
        dir,
        "Stop",
        JSON.stringify({
          session_id: incompleteId,
          transcript_path: incompleteFile,
          cwd: dir,
        }),
        process.execPath,
        "-e",
        "",
      ).status,
    ).toBe(0);
    const incomplete = openStore(dir, { readOnly: true });
    try {
      expect(incomplete.get(incompleteId).session.base).toBeNull();
      expect(incomplete.get(incompleteId).verdicts).toHaveLength(0);
    } finally {
      incomplete.close();
    }
    expect(
      runAgent("codex", dir, "SessionStart", input, process.execPath, "-e", "")
        .status,
    ).toBe(0);
    for (let repeat = 0; repeat < 2; repeat++) {
      const stop = runAgent(
        "codex",
        dir,
        "Stop",
        input,
        process.execPath,
        "-e",
        "",
      );
      expect(stop.status, stop.stderr.toString()).toBe(0);
      expect(stop.stderr.toString()).not.toContain("recorder unavailable");
    }
    const store = openStore(dir, { readOnly: true });
    try {
      const record = store.get(id);
      expect(record.session).toMatchObject({
        agent: "codex",
        model: "gpt-recorded",
        base: head,
        head,
      });
      expect(
        record.events.filter((row: { event: string }) => row.event === "Stop"),
      ).toHaveLength(2);
      expect(
        record.events.every((row: { agent: string }) => row.agent === "codex"),
      ).toBe(true);
      expect(
        store.list().filter((session: { id: string }) => session.id === id),
      ).toHaveLength(1);
    } finally {
      store.close();
    }
    const marker = join(dir, ".os/recorder-unavailable");
    writeFileSync(marker, "earlier outage");
    const blocked = runAgent(
      "codex",
      dir,
      "Stop",
      input,
      process.execPath,
      "-e",
      "process.exitCode=2",
    );
    expect(blocked.status).toBe(2);
    expect(readFileSync(marker, "utf8")).toBe("earlier outage");
    const pending = openStore(dir, { readOnly: true });
    try {
      expect(pending.get(id).session.endedAt).toBeNull();
    } finally {
      pending.close();
    }
  }, 60_000);

  it("evaluates an unchanged HEAD's dirty tracked and untracked source on automatic Stop", async () => {
    const { dir, head } = fixture(),
      file = transcript(dir);
    writeFileSync(join(dir, ".git/info/exclude"), ".os/\ntranscript.jsonl\n");
    const input = JSON.stringify({
      session_id: "real-shape",
      transcript_path: file,
    });
    expect(
      run(dir, "SessionStart", input, process.execPath, "-e", "").status,
    ).toBe(0);
    mkdirSync(join(dir, "src/components"), { recursive: true });
    writeFileSync(
      join(dir, "src/components/Card.tsx"),
      "export const Card = () => { console.log('recorded debt'); return null; };\n",
    );
    const stop = run(dir, "Stop", input, process.execPath, "-e", "");
    expect(stop.status, stop.stderr.toString()).toBe(0);
    const store = openStore(dir, { readOnly: true });
    try {
      const record = store.get("real-shape");
      expect(record.session).toMatchObject({
        base: head,
        head,
        rangeSource: "runner lifecycle: uncommitted working tree",
      });
      expect(
        record.verdicts.find((row: { rule: string }) => row.rule === "HR-22"),
      ).toMatchObject({ verdict: "fail", file: "src/components/Card.tsx" });
      expect(
        record.session.changeFacts.map((row: { file: string }) => row.file),
      ).toContain("src/components/Card.tsx");
      expect(markdown(record)).toContain("uncommitted working tree");
    } finally {
      store.close();
    }
    // A historical re-import cannot silently borrow the current working tree.
    await ingest({ root: dir, transcript: file });
    const historical = openStore(dir, { readOnly: true });
    try {
      expect(historical.get("real-shape").session.rangeSource).toBe(
        "runner lifecycle",
      );
    } finally {
      historical.close();
    }
  }, 60_000);
  it("preserves byte stdin/stdout/stderr and exits 0, 1 and blocking 2", () => {
    const { dir } = fixture();
    const input = Buffer.from(
      JSON.stringify({
        session_id: "equivalence",
        tool_name: "Edit",
        tool_input: { file_path: "src/x.ts" },
        data: "é".repeat(50000),
      }),
    );
    for (const exit of [0, 1, 2]) {
      const script = `process.stdin.pipe(process.stdout); process.stdin.on('end',()=>{process.stderr.write('diagnostic');process.exitCode=${exit}})`;
      const direct = spawnSync(process.execPath, ["-e", script], { input });
      const wrapped = run(
        dir,
        "PreToolUse",
        input,
        process.execPath,
        "-e",
        script,
      );
      expect(wrapped.status, wrapped.stderr.toString()).toBe(direct.status);
      expect(wrapped.stdout.equals(direct.stdout)).toBe(true);
      expect(wrapped.stderr.equals(direct.stderr)).toBe(true);
    }
    const events = readFileSync(eventFile(dir, "equivalence"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.map((row) => row.exitCode)).toEqual([0, 1, 2]);
    expect(events[2]).toMatchObject({
      blocked: true,
      paths: ["src/x.ts"],
      tool: "Edit",
      source: "runner",
    });
    expect(events.every((row) => row.durationMs >= 0)).toBe(true);
  }, 60_000);

  it("leaves the real guard working with the wrapper removed", () => {
    const { dir } = fixture();
    mkdirSync(join(dir, "scripts"));
    writeFileSync(
      join(dir, "scripts/agent-tool-paths.mjs"),
      readFileSync(join(root, "scripts/agent-tool-paths.mjs")),
    );
    for (const path of [
      "src/components/ui/button.tsx",
      "src/components/allowed.tsx",
    ]) {
      const input = JSON.stringify({
        session_id: "real-guard",
        tool_input: { file_path: path },
      });
      const args = [join(root, ".claude/hooks/block-ui-dir.sh")];
      const direct = spawnSync(shellProgram("bash"), args, {
        cwd: root,
        input,
      });
      const wrapped = run(dir, "PreToolUse", input, "bash", ...args);
      expect(wrapped.status).toBe(direct.status);
      expect(wrapped.stdout.equals(direct.stdout)).toBe(true);
      expect(wrapped.stderr.equals(direct.stderr)).toBe(true);
    }
  }, 60_000);

  it("preserves denial/output when .os is unwritable or payload is invalid", () => {
    const { dir } = fixture();
    writeFileSync(join(dir, ".os"), "directory unavailable");
    for (const input of [
      "invalid json",
      JSON.stringify({ session_id: "broken" }),
    ]) {
      const result = run(
        dir,
        "PreToolUse",
        input,
        process.execPath,
        "-e",
        "process.stdout.write('unchanged');process.exitCode=2",
      );
      expect(result.status).toBe(2);
      expect(result.stdout.toString()).toBe("unchanged");
      expect(result.stderr.toString()).toContain("recorder unavailable");
    }
  }, 60_000);

  it("redacts diagnostics at write time without changing hook output", () => {
    const { dir } = fixture(),
      secret = "sk-test_secret_123456789";
    const result = run(
      dir,
      "PostToolUse",
      JSON.stringify({ session_id: "privacy" }),
      process.execPath,
      "-e",
      `process.stderr.write('api_key=${secret}')`,
    );
    expect(result.stderr.toString()).toContain(secret);
    expect(readFileSync(eventFile(dir, "privacy"), "utf8")).not.toContain(
      secret,
    );
  }, 60_000);

  it("records lifecycle setup/base and auto-ingests Stop without affecting exit", () => {
    const { dir, head } = fixture(),
      file = transcript(dir);
    const input = JSON.stringify({
      session_id: "real-shape",
      transcript_path: file,
    });
    expect(
      run(dir, "SessionStart", input, process.execPath, "-e", "").status,
    ).toBe(0);
    const stop = run(dir, "Stop", input, process.execPath, "-e", "");
    expect(stop.status, stop.stderr.toString()).toBe(0);
    const store = openStore(dir, { readOnly: true });
    try {
      const record = store.get("real-shape");
      expect(record.session).toMatchObject({
        base: head,
        head,
        setup: { fingerprint: expect.stringMatching(/^sha256:/) },
      });
      expect(record.session.endedAt).toBeTruthy();
      expect(record.verdicts).toHaveLength(21);
      expect(
        record.events.filter((row: { event: string }) => row.event === "Stop"),
      ).toHaveLength(1);
    } finally {
      store.close();
    }
  }, 60_000);

  it("ingests a 467-file lifecycle range inside the Stop budget and clears an earlier failure marker", () => {
    const { dir } = fixture(),
      file = transcript(dir);
    writeFileSync(join(dir, ".git/info/exclude"), ".os/\ntranscript.jsonl\n");
    const input = JSON.stringify({
      session_id: "real-shape",
      transcript_path: file,
    });
    expect(
      run(dir, "SessionStart", input, process.execPath, "-e", "").status,
    ).toBe(0);
    mkdirSync(join(dir, "src/components"), { recursive: true });
    mkdirSync(join(dir, "docs"));
    for (let i = 0; i < 467; i++)
      writeFileSync(
        join(
          dir,
          i < 250 ? `src/components/Card ${i}.tsx` : `docs/Note ${i}.md`,
        ),
        i < 250 ? `export const n${i} = ${i};\n` : `Note ${i}\n`,
      );
    const commit = spawnSync("git", ["add", "."], { cwd: dir });
    expect(commit.status).toBe(0);
    const saved = spawnSync(
      "git",
      [
        "-c",
        "user.name=A3",
        "-c",
        "user.email=a3@example.invalid",
        "-c",
        "core.hooksPath=.no-hooks",
        "-c",
        "commit.gpgSign=false",
        "commit",
        "--quiet",
        "-m",
        "467 files",
      ],
      { cwd: dir },
    );
    expect(saved.status, saved.stderr.toString()).toBe(0);
    const marker = join(dir, ".os/recorder-unavailable");
    writeFileSync(marker, "2026-11-15T06:39:25.775Z");
    const stop = run(dir, "Stop", input, process.execPath, "-e", "");
    expect(stop.status, stop.stderr.toString()).toBe(0);
    expect(stop.stderr.toString()).not.toContain("recorder unavailable");
    expect(existsSync(marker)).toBe(false);
    const store = openStore(dir, { readOnly: true });
    try {
      const record = store.get("real-shape");
      expect(record.session.changeFacts).toHaveLength(467);
      expect(record.verdicts).toHaveLength(21);
      expect(record.session.scorecard.checks.verdict).toBe("unknown");
    } finally {
      store.close();
    }
  }, 60_000);

  it("records the ingest failure detail and preserves the wrapped Stop result", () => {
    const { dir } = fixture(),
      file = join(dir, "broken.jsonl");
    writeFileSync(file, '{"partial":');
    const result = run(
      dir,
      "Stop",
      JSON.stringify({ session_id: "broken", transcript_path: file }),
      process.execPath,
      "-e",
      "process.stdout.write('same');process.exitCode=2",
    );
    expect(result.status).toBe(2);
    expect(result.stdout.toString()).toBe("same");
    expect(existsSync(join(dir, ".os/recorder-unavailable"))).toBe(true);
    const events = readFileSync(eventFile(dir, "broken"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.at(-1)).toMatchObject({
      event: "unavailable",
      message: expect.stringContaining("Invalid transcript JSON at line 1"),
    });
  }, 60_000);

  it("keeps the first unavailable time across recording and ingest failures until recovery", () => {
    const { dir } = fixture(),
      marker = join(dir, ".os/recorder-unavailable");
    const first = run(
      dir,
      "PreToolUse",
      "invalid json",
      process.execPath,
      "-e",
      "",
    );
    expect(first.status).toBe(0);
    const since = readFileSync(marker, "utf8");
    expect(Number.isFinite(Date.parse(since))).toBe(true);
    const file = join(dir, "broken-again.jsonl");
    writeFileSync(file, '{"partial":');
    const next = run(
      dir,
      "Stop",
      JSON.stringify({
        session_id: "continuous-outage",
        transcript_path: file,
      }),
      process.execPath,
      "-e",
      "",
    );
    expect(next.status).toBe(0);
    expect(next.stderr.toString()).toContain("recorder unavailable");
    expect(readFileSync(marker, "utf8")).toBe(since);
  }, 60_000);
});

describe("A3 read-only transcript ingest and durable report", () => {
  it("attributes the majority of assistant turns instead of the trailing housekeeping model", async () => {
    const { dir } = fixture(),
      file = transcript(dir);
    const rows = readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    for (const row of rows)
      if (row.type === "assistant") row.message.model = "claude-fable-recorded";
    rows.push({
      type: "assistant",
      uuid: "last-cheap",
      timestamp: at(8),
      sessionId: "real-shape",
      message: { id: "cheap", model: "claude-haiku-recorded", content: [] },
    });
    writeFileSync(
      file,
      rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    );
    const facts = await readClaude(file);
    expect(facts.turns).toBe(4);
    expect(facts.model).toBe("claude-fable-recorded");
    mkdirSync(join(dir, "ERA Notes"), { recursive: true });
    writeFileSync(
      join(dir, "ERA Notes/Model-Registry.md"),
      "| `CLAUDE_MID` | Claude | Fable | `claude-fable-recorded` | high |\n" +
        "| `CLAUDE_LOW` | Claude | Haiku | `claude-haiku-recorded` | low |\n",
    );
    const session = await ingest({ root: dir, transcript: file });
    expect(session).toMatchObject({
      model: "claude-fable-recorded",
      tier: "CLAUDE_MID",
    });
  });
  it("attributes Codex's model by distinct assistant turns rather than the final context", async () => {
    const { dir } = fixture(),
      file = join(dir, "majority-codex.jsonl");
    const rows: object[] = [
      {
        type: "session_meta",
        timestamp: at(0),
        payload: { id: "codex-majority", cwd: dir },
      },
    ];
    for (const [index, model] of [
      "gpt-majority",
      "gpt-majority",
      "gpt-majority",
      "gpt-tail",
    ].entries()) {
      rows.push({
        type: "turn_context",
        timestamp: at(index + 1),
        payload: {
          turn_id: `turn-${index}`,
          model,
          effort: index % 2 ? "high" : "medium",
        },
      });
      rows.push({
        type: "response_item",
        timestamp: at(index + 1),
        payload: {
          type: "message",
          role: "assistant",
          id: `message-${index}`,
          content: [],
        },
      });
    }
    writeFileSync(
      file,
      rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    );
    const facts = await readCodex(file);
    expect(facts.model).toBe("gpt-majority");
    expect(facts.effort).toBe("medium");
  });
  it("reads the privacy-trimmed sample from a real Claude session", async () => {
    const file = join(root, "tests/os/fixtures/claude-recorded.jsonl"),
      before = readFileSync(file);
    const facts = await readClaude(file);
    expect(facts.id).toBe("4db77e08-0b3e-420d-9434-0458e2dc5e85");
    expect(facts.skills.map((row) => row.name)).toEqual(["start-task"]);
    expect(facts.hooks.map((row) => row.durationMs)).toEqual([1698, 686]);
    expect(facts.usage).toEqual({
      input_tokens: 2,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 56428,
      output_tokens: 118,
    });
    expect(readFileSync(file).equals(before)).toBe(true);
  });

  it("derives skills/reads/checks, deduplicates streaming usage and survives reopen/reingest", async () => {
    const { dir, head } = fixture(),
      file = transcript(dir),
      bytes = readFileSync(file);
    const facts = await readClaude(file);
    expect(facts.skills.map((row) => row.name)).toEqual([
      "start-task",
      "finish-task",
    ]);
    expect(facts.reads.every((row) => row.beforeFirstEdit)).toBe(true);
    expect(facts.usage).toEqual({
      input_tokens: 6,
      cache_read_input_tokens: 40,
      cache_creation_input_tokens: 20,
      output_tokens: 10,
    });
    expect(facts.turns).toBe(3);
    expect(facts.checks[0]).toMatchObject({
      name: "typecheck",
      exitCode: 0,
      durationMs: 1000,
    });
    for (let repeat = 0; repeat < 2; repeat++)
      await ingest({ root: dir, transcript: file, range: `${head}..${head}` });
    expect(readFileSync(file).equals(bytes)).toBe(true);
    const store = openStore(dir, { readOnly: true });
    try {
      const record = store.get("real-shape"),
        report = markdown(record);
      expect(record.events).toHaveLength(1);
      expect(record.verdicts).toHaveLength(21);
      expect(record.checks).toHaveLength(1);
      expect(record.events[0]).toMatchObject({
        source: "transcript",
        exitCode: null,
        durationMs: 77,
      });
      expect(record.session.setup).toBeNull();
      expect(record.session.endedAt).toBeNull();
      expect(report).toContain("start-task");
      expect(report).toContain("HR-22");
      expect(report).toContain("historical setup");
      expect(JSON.stringify(record)).not.toMatch(
        /PRIVATE|never-store|private-shell-key/,
      );
      const cli = spawnSync(
        process.execPath,
        [join(root, "scripts/os/report.mjs"), "real-shape"],
        { cwd: dir, encoding: "utf8" },
      );
      expect(cli.status, cli.stderr).toBe(0);
      expect(cli.stdout).toBe(report);
    } finally {
      store.close();
    }
  }, 60_000);

  it("refuses unknown versions, bad identity and truncated JSON without replacing stored evidence", async () => {
    const { dir } = fixture(),
      file = transcript(dir);
    await ingest({ root: dir, transcript: file });
    await expect(
      ingest({ root: dir, transcript: file, sessionId: "another-session" }),
    ).rejects.toThrow("identity mismatch");
    writeFileSync(file, readFileSync(file, "utf8") + '{"partial":');
    await expect(ingest({ root: dir, transcript: file })).rejects.toThrow(
      "no rows changed",
    );
    const store = openStore(dir, { readOnly: true });
    expect(store.get("real-shape").session.skills).toHaveLength(2);
    store.close();
    const corrupt = spawnSync(process.execPath, [
      "--input-type=module",
      "-e",
      "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync(process.argv[1]); db.exec('PRAGMA user_version=99'); db.close();",
      join(dir, ".os/os.db"),
    ]);
    expect(corrupt.status).toBe(0);
    expect(() => openStore(dir)).toThrow("Unsupported OS store version");
    expect(() => appendEvent(dir, { schema: "os/event@99" })).toThrow(
      "Unsupported event schema",
    );
  }, 60_000);

  it("rolls back a failed replacement and refuses unknown row versions", async () => {
    const { dir } = fixture(),
      file = transcript(dir);
    await ingest({ root: dir, transcript: file });
    const store = openStore(dir);
    try {
      const record = store.get("real-shape");
      expect(() =>
        store.put({
          ...record,
          session: { ...record.session, schema: "os/session@2" },
        }),
      ).toThrow("Unsupported schema");
      expect(() =>
        store.put({
          ...record,
          session: { ...record.session, outcome: "must roll back" },
          events: [record.events[0], record.events[0]],
        }),
      ).toThrow();
      expect(store.get("real-shape").session.outcome).toBe("unrecorded");
      expect(store.get("real-shape").events).toHaveLength(1);
    } finally {
      store.close();
    }
  }, 60_000);
});
