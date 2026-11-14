import { afterAll, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, OS_AGENT: "claude" },
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
  });

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
  });

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
  });

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
  });

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
  }, 15000);
});

describe("A3 read-only transcript ingest and durable report", () => {
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
  });

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
  });

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
  });
});
