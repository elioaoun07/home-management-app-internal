// A3: recorder errors must never replace the wrapped hook's result.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toolPaths } from "../agent-tool-paths.mjs";
import { safeFacts, short } from "./privacy.mjs";
import { eventFile, gitFact } from "./runtime.mjs";
export { eventFile, gitFact } from "./runtime.mjs";

export function shellProgram(program) {
  if (program !== "bash" || process.platform !== "win32") return program;
  const git = spawnSync("git", ["--exec-path"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return git.status === 0
    ? resolve(git.stdout.trim(), "../../..", "bin/bash.exe")
    : program;
}
export function appendEvent(root, event) {
  if (event.schema !== "os/event@1")
    throw new Error("Unsupported event schema");
  const directory = resolve(root, ".os/events");
  mkdirSync(directory, { recursive: true });
  // Only our flat runtime event files, never transcripts or arbitrary paths.
  for (const name of readdirSync(directory))
    if (/^[a-f0-9]{64}\.jsonl$/.test(name)) {
      const file = resolve(directory, name);
      if (
        statSync(file).isFile() &&
        Date.now() - statSync(file).mtimeMs > 90 * 86400000
      )
        unlinkSync(file);
    }
  appendFileSync(
    eventFile(root, event.sessionId),
    `${JSON.stringify(safeFacts(event))}\n`,
    { mode: 0o600 },
  );
}

function markUnavailable(root, timestamp) {
  mkdirSync(resolve(root, ".os"), { recursive: true });
  const marker = resolve(root, ".os/recorder-unavailable");
  if (!existsSync(marker)) writeFileSync(marker, timestamp);
}

export async function runHook({ root, name, event, program, args, input }) {
  const started = new Date().toISOString(),
    start = performance.now();
  // tee bytes to the native hook streams; retain only a bounded diagnostic.
  let output = Buffer.alloc(0),
    diagnostic = Buffer.alloc(0);
  const result = await new Promise((done) => {
    const child = spawn(shellProgram(program), args, {
      cwd: root,
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      if (output.length < 4096)
        output = Buffer.concat([output, chunk]).subarray(0, 4096);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      if (diagnostic.length < 4096)
        diagnostic = Buffer.concat([diagnostic, chunk]).subarray(0, 4096);
    });
    child.stdin.on("error", () => {}); // A hook may deliberately ignore stdin.
    child.on("error", (error) => {
      process.stderr.write(`${error.message}\n`);
    });
    child.on("close", (code, signal) => done({ code, signal }));
    child.stdin.end(input);
  });
  const durationMs = Math.round(performance.now() - start);
  try {
    const payload = JSON.parse(input.toString("utf8"));
    const sessionId = payload.session_id ?? payload.sessionId;
    if (
      typeof sessionId !== "string" ||
      !sessionId.length ||
      sessionId.length > 200
    )
      throw new Error("Missing session id");
    let decision = null;
    try {
      decision = JSON.parse(output.toString("utf8")).decision ?? null;
    } catch {
      /* plain text hook */
    }
    const row = {
      schema: "os/event@1",
      id: randomUUID(),
      sessionId,
      source: "runner",
      event,
      hook: name,
      agent: process.env.OS_AGENT === "codex" ? "codex" : "claude",
      timestamp: started,
      durationMs,
      tool: short(payload.tool_name ?? "", 80),
      paths: toolPaths(payload).map((path) => short(path)),
      exitCode: result.code,
      signal: result.signal,
      blocked: result.code === 2 || decision === "block",
      message: short(diagnostic.toString("utf8") || output.toString("utf8")),
    };
    if (event === "SessionStart" || event === "Stop") {
      row.git = {
        head: gitFact(root, "rev-parse", "--verify", "HEAD"),
        branch: gitFact(root, "branch", "--show-current"),
        dirty: Boolean(gitFact(root, "status", "--porcelain")),
        worktree: root,
      };
    }
    if (event === "SessionStart") {
      try {
        const { scan } = await import("./scan.mjs");
        const setup = scan(root);
        // No source text or permission values copied into the recorder.
        row.setup = {
          fingerprint: setup.fingerprint,
          counts: setup.counts,
          observedAt: started,
        };
      } catch {
        row.recorderWarning = "setup unavailable";
      }
    }
    appendEvent(root, row);
    if (event === "Stop" && payload.transcript_path) {
      try {
        // Keep SQLite's optional driver/warnings and ingest failures outside the
        // passthrough process. Bound the work; a hung importer cannot hold Stop.
        const imported = spawnSync(
          process.execPath,
          [
            "--disable-warning=ExperimentalWarning",
            fileURLToPath(new URL("./ingest.mjs", import.meta.url)),
            payload.transcript_path,
            "--session",
            sessionId,
            "--agent",
            row.agent,
            "--working-tree",
          ],
          {
            cwd: root,
            encoding: "utf8",
            windowsHide: true,
            timeout: 20000,
          },
        );
        if (imported.status !== 0)
          throw new Error(
            short(
              imported.error?.message ||
                imported.stderr ||
                `Ingest exited ${imported.status ?? imported.signal ?? "unknown"}`,
              1000,
            ),
          );
      } catch (error) {
        const timestamp = new Date().toISOString();
        markUnavailable(root, timestamp);
        appendEvent(root, {
          schema: "os/event@1",
          id: randomUUID(),
          sessionId,
          source: "recorder",
          event: "unavailable",
          timestamp,
          message: "recorder unavailable: " + short(error.message, 1000),
        });
        process.stderr.write(
          "os: recorder unavailable (ingest); hook result preserved\n",
        );
      }
    }
  } catch {
    // Best effort marker: a read-only/full .os may prevent this too. Ingest also
    // reports absent lifecycle evidence, rather than treating it as zero hooks.
    try {
      markUnavailable(root, new Date().toISOString());
    } catch {
      /* no writable recorder */
    }
    process.stderr.write("os: recorder unavailable; hook result preserved\n");
  }
  return result;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [name, event, separator, program, ...args] = process.argv.slice(2);
  if (!name || !event || separator !== "--" || !program) {
    process.stderr.write(
      "Usage: node scripts/os/hook.mjs <name> <event> -- <program> [args...]\n",
    );
    process.exitCode = 1;
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const result = await runHook({
      root: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      name,
      event,
      program,
      args,
      input: Buffer.concat(chunks),
    });
    if (result.signal) process.kill(process.pid, result.signal);
    else process.exitCode = result.code ?? 1;
  }
}
