import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DriverAbortedError, DriverError, createDriver, listRegisteredDrivers } from "../../scripts/delivery/drivers/driver.mjs";
// Importing claude.mjs self-registers "claude" into the shared driver registry.
import {
  bridgeAbortSignal,
  buildCanUseTool,
  buildSessionOptions,
  assertNeverBypass,
  containsSecretReference,
  createClaudeDriver,
  extractUsage,
  interpretPreflightMessages,
  interpretResultMessage,
  isForbiddenByConfig,
  isGitMutatingCommand,
  isSecretFilename,
  isSecretPath,
  isWithinAllowedRoots,
  manifest,
  mapSdkMessageToEvents,
  mapSdkMessageToRawRecords,
  PREFLIGHT_TIMEOUT_MS,
  withOutputSchema,
  withSessionIdentity,
} from "../../scripts/delivery/drivers/claude.mjs";

const CWD = "/repo";

describe("manifest (DW-2, pure data, no SDK import)", () => {
  it("declares the claude capability surface", () => {
    const m = manifest();
    expect(m.provider).toBe("claude");
    expect(m.efforts).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(m.supportsPerTurnModel).toBe(true);
    expect(m.supportsNativeFork).toBe(true);
    expect(m.usage).toEqual({ cacheCreation: true, reasoning: false, costReported: true });
  });

  it("is exposed on the driver instance without touching the SDK", () => {
    const driver = createClaudeDriver({ importSdk: async () => { throw new Error("must not be called"); } });
    expect(driver.manifest()).toEqual(manifest());
  });

  it("declares abort support (DW-10)", () => {
    expect(manifest().supportsAbort).toBe(true);
  });
});

describe("bridgeAbortSignal (DW-10)", () => {
  it("returns a fresh, unaborted controller when no signal is given", () => {
    const controller = bridgeAbortSignal(undefined);
    expect(controller.signal.aborted).toBe(false);
  });

  it("aborts the local controller immediately if the incoming signal is already aborted", () => {
    const external = new AbortController();
    external.abort();
    const controller = bridgeAbortSignal(external.signal);
    expect(controller.signal.aborted).toBe(true);
  });

  it("forwards a later abort on the incoming signal to the local controller", () => {
    const external = new AbortController();
    const controller = bridgeAbortSignal(external.signal);
    expect(controller.signal.aborted).toBe(false);
    external.abort();
    expect(controller.signal.aborted).toBe(true);
  });
});
const SESSION_DIR = "/repo/.delivery/sessions/abc123";

function asyncGen(items: unknown[]) {
  return (async function* () {
    for (const item of items) yield item;
  })();
}

const SYSTEM_INIT = {
  type: "system",
  subtype: "init",
  model: "claude-opus-4-8",
  permissionMode: "acceptEdits",
  tools: ["Read", "Write", "Bash"],
};

function assistantText(text: string) {
  return { type: "assistant", message: { content: [{ type: "text", text }] }, parent_tool_use_id: null };
}

function assistantToolUse(name: string, input: Record<string, unknown>) {
  return { type: "assistant", message: { content: [{ type: "tool_use", name, input }] }, parent_tool_use_id: null };
}

function userToolResult(content: unknown, isError = false) {
  return { type: "user", message: { content: [{ type: "tool_result", content, is_error: isError }] }, parent_tool_use_id: null };
}

function resultSuccess(overrides: Record<string, unknown> = {}) {
  return {
    type: "result",
    subtype: "success",
    is_error: false,
    num_turns: 1,
    result: '{"ok":true}',
    stop_reason: null,
    total_cost_usd: 0.01,
    usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 10 },
    ...overrides,
  };
}

function resultError(overrides: Record<string, unknown> = {}) {
  return {
    type: "result",
    subtype: "error_during_execution",
    is_error: true,
    num_turns: 1,
    stop_reason: "overloaded",
    errors: ["boom"],
    total_cost_usd: 0,
    usage: { input_tokens: 5, output_tokens: 0, cache_read_input_tokens: 0 },
    ...overrides,
  };
}

describe("driver registry: claude", () => {
  it("registers 'claude' after importing claude.mjs", () => {
    expect(listRegisteredDrivers()).toContain("claude");
  });

  it("createDriver('claude', ...) returns a driver with the standard shape", () => {
    const driver = createDriver("claude", {});
    expect(driver.kind).toBe("claude");
    expect(typeof driver.startSession).toBe("function");
    expect(typeof driver.resume).toBe("function");
    expect(typeof driver.runTurn).toBe("function");
  });
});

describe("isSecretFilename / isSecretPath", () => {
  it("flags dotenv-style filenames", () => {
    expect(isSecretFilename(".env")).toBe(true);
    expect(isSecretFilename(".env.local")).toBe(true);
    expect(isSecretFilename("env.ts")).toBe(false);
  });

  it("flags key/credential filenames", () => {
    expect(isSecretFilename("id_rsa")).toBe(true);
    expect(isSecretFilename("server.pem")).toBe(true);
    expect(isSecretFilename("credentials.json")).toBe(true);
    expect(isSecretFilename("README.md")).toBe(false);
  });

  it("denies a .env file inside the working tree", () => {
    expect(isSecretPath(".env", { cwd: CWD })).toBe(true);
    expect(isSecretPath("src/app/.env.local", { cwd: CWD })).toBe(true);
  });

  it("allows an ordinary repo file", () => {
    expect(isSecretPath("src/app/page.tsx", { cwd: CWD })).toBe(false);
  });

  it("denies paths under the home directory that escape the working tree", () => {
    const outside = join(homedir(), ".claude", "settings.json");
    expect(isSecretPath(outside, { cwd: CWD })).toBe(true);
  });

  it("denies .delivery/ paths outside the session's own directory", () => {
    const otherSession = "/repo/.delivery/sessions/other-session/state.json";
    expect(isSecretPath(otherSession, { cwd: CWD, sessionDir: SESSION_DIR })).toBe(true);
    expect(isSecretPath("/repo/.delivery/config.json", { cwd: CWD, sessionDir: SESSION_DIR })).toBe(true);
  });

  it("allows paths inside the session's own .delivery/ directory", () => {
    expect(isSecretPath("/repo/.delivery/sessions/abc123/artifacts/spec.md", { cwd: CWD, sessionDir: SESSION_DIR })).toBe(
      false,
    );
  });
});

describe("isWithinAllowedRoots", () => {
  it("allows paths inside cwd", () => {
    expect(isWithinAllowedRoots("src/app/page.tsx", { cwd: CWD })).toBe(true);
  });

  it("allows paths inside the session dir even when outside cwd", () => {
    expect(isWithinAllowedRoots("/elsewhere/session/file.md", { cwd: CWD, sessionDir: "/elsewhere/session" })).toBe(true);
  });

  it("denies paths escaping both roots", () => {
    expect(isWithinAllowedRoots("/etc/passwd", { cwd: CWD, sessionDir: SESSION_DIR })).toBe(false);
  });
});

// BUD-11 root cause #7: on win32, a POSIX-shaped absolute path emitted by the
// SDK (e.g. "/home/<user>/WebApp/budget-app/ERA Notes/...") is not a real
// Windows-absolute path, but Node's win32 path.isAbsolute() treated the
// leading "/" as absolute and resolve() re-rooted it onto the current drive
// as "C:\home\<user>\..." — never matching any allowed root. These tests only
// exercise the win32 branch; skip on POSIX CI runners where the bug (and its
// fix) doesn't apply.
const itWin32 = process.platform === "win32" ? it : it.skip;

describe("isWithinAllowedRoots: POSIX-shaped absolute paths on win32 (BUD-11 path-guard bug)", () => {
  itWin32("re-anchors a POSIX-absolute path at cwd's own trailing segments instead of denying it", () => {
    // CWD is "/repo" (single segment "repo") — a POSIX-style absolute path
    // that contains "repo" as a segment, followed by an in-repo relative
    // path, is the exact shape observed in BUD-11 session forensics
    // ("/home/<user>/WebApp/budget-app/ERA Notes/..." echoing cwd under a
    // different root prefix).
    expect(
      isWithinAllowedRoots("/home/someone/repo/ERA Notes/10 - Project Management/Budget/1 - Feature State.md", {
        cwd: CWD,
      }),
    ).toBe(true);
  });

  itWin32("does not double up cwd when re-anchoring (regression: naive strip-and-append)", () => {
    const abs = isSecretPath("/home/someone/repo/src/app/page.tsx", { cwd: CWD }); // reuses toAbsolute internally
    expect(abs).toBe(false); // an ordinary file, not a secret — proves resolution didn't produce a bogus/duplicated path
    expect(isWithinAllowedRoots("/home/someone/repo/src/app/page.tsx", { cwd: CWD })).toBe(true);
  });

  itWin32("still denies a POSIX path with no recognizable overlap with cwd (fail-closed)", () => {
    expect(isWithinAllowedRoots("/etc/passwd", { cwd: CWD })).toBe(false);
  });

  itWin32("still allows an ordinary Windows-absolute path unaffected by the reinterpretation", () => {
    expect(isWithinAllowedRoots("C:\\repo\\src\\app\\page.tsx", { cwd: CWD })).toBe(true);
  });
});

describe("isForbiddenByConfig", () => {
  it("matches a ** glob against a nested path", () => {
    expect(isForbiddenByConfig("src/components/ui/button.tsx", { cwd: CWD, forbiddenPaths: ["src/components/ui/**"] })).toBe(
      true,
    );
  });

  it("does not match outside the glob", () => {
    expect(isForbiddenByConfig("src/features/accounts/index.ts", { cwd: CWD, forbiddenPaths: ["src/components/ui/**"] })).toBe(
      false,
    );
  });

  it("returns false when no forbiddenPaths configured", () => {
    expect(isForbiddenByConfig("src/components/ui/button.tsx", { cwd: CWD })).toBe(false);
  });
});

describe("isGitMutatingCommand: allowlist-based, never names mutating subcommands", () => {
  it("allows every read-only subcommand", () => {
    for (const sub of ["status", "diff", "log", "show", "rev-parse", "for-each-ref"]) {
      expect(isGitMutatingCommand(`git ${sub}`)).toBe(false);
    }
  });

  it("denies commit/push/pull and friends", () => {
    expect(isGitMutatingCommand('git commit -m "x"')).toBe(true);
    expect(isGitMutatingCommand("git push origin main")).toBe(true);
    expect(isGitMutatingCommand("git checkout -b feature")).toBe(true);
    expect(isGitMutatingCommand("git branch new-branch")).toBe(true);
    expect(isGitMutatingCommand("git reset --hard")).toBe(true);
  });

  it("denies chained commands where any segment mutates", () => {
    expect(isGitMutatingCommand("pnpm test && git commit -am wip")).toBe(true);
    expect(isGitMutatingCommand("git status; git push")).toBe(true);
    expect(isGitMutatingCommand("git status\ngit add .")).toBe(true);
  });

  it("allows non-git commands and chained read-only git", () => {
    expect(isGitMutatingCommand("pnpm typecheck && pnpm test")).toBe(false);
    expect(isGitMutatingCommand("git status && git diff HEAD~1")).toBe(false);
  });

  it("allows bare git with no subcommand", () => {
    expect(isGitMutatingCommand("git")).toBe(false);
  });

  it("fails closed on unrecognized flags before the subcommand", () => {
    expect(isGitMutatingCommand("git -C . status")).toBe(true);
  });
});

describe("containsSecretReference", () => {
  it("flags known secret file references in shell text", () => {
    expect(containsSecretReference("cat .env")).toBe(true);
    expect(containsSecretReference("cat ~/.ssh/id_rsa")).toBe(true);
    expect(containsSecretReference("cat ~/.claude/settings.json")).toBe(true);
  });

  it("does not flag ordinary commands", () => {
    expect(containsSecretReference("pnpm test")).toBe(false);
    expect(containsSecretReference("cat src/app/page.tsx")).toBe(false);
  });
});

describe("buildCanUseTool", () => {
  it("denies a git-mutating Bash command", async () => {
    const canUseTool = buildCanUseTool({ cwd: CWD, sessionDir: SESSION_DIR });
    const result = await canUseTool("Bash", { command: "git commit -am wip" }, {});
    expect(result.behavior).toBe("deny");
  });

  it("allows a read-only git Bash command", async () => {
    const canUseTool = buildCanUseTool({ cwd: CWD, sessionDir: SESSION_DIR });
    const result = await canUseTool("Bash", { command: "git status --porcelain" }, {});
    expect(result.behavior).toBe("allow");
  });

  it("denies reading a secret path", async () => {
    const canUseTool = buildCanUseTool({ cwd: CWD, sessionDir: SESSION_DIR });
    const result = await canUseTool("Read", { file_path: ".env" }, {});
    expect(result.behavior).toBe("deny");
  });

  it("allows reading an ordinary repo file", async () => {
    const canUseTool = buildCanUseTool({ cwd: CWD, sessionDir: SESSION_DIR });
    const result = await canUseTool("Read", { file_path: "src/app/page.tsx" }, {});
    expect(result.behavior).toBe("allow");
  });

  it("denies writing outside the allowed roots", async () => {
    const canUseTool = buildCanUseTool({ cwd: CWD, sessionDir: SESSION_DIR });
    const result = await canUseTool("Write", { file_path: "/etc/hosts" }, {});
    expect(result.behavior).toBe("deny");
  });

  it("denies writing to a forbidden-path glob", async () => {
    const canUseTool = buildCanUseTool({ cwd: CWD, sessionDir: SESSION_DIR, forbiddenPaths: ["src/components/ui/**"] });
    const result = await canUseTool("Write", { file_path: "src/components/ui/button.tsx" }, {});
    expect(result.behavior).toBe("deny");
  });

  it("allows writing an ordinary repo file", async () => {
    const canUseTool = buildCanUseTool({ cwd: CWD, sessionDir: SESSION_DIR });
    const result = await canUseTool("Write", { file_path: "src/features/accounts/index.ts" }, {});
    expect(result.behavior).toBe("allow");
  });
});

describe("assertNeverBypass", () => {
  it("throws for bypassPermissions", () => {
    expect(() => assertNeverBypass({ permissionMode: "bypassPermissions" })).toThrow(DriverError);
  });

  it("passes through any other mode", () => {
    expect(assertNeverBypass({ permissionMode: "acceptEdits" })).toEqual({ permissionMode: "acceptEdits" });
  });
});

describe("buildSessionOptions", () => {
  it("throws for an unknown mode", () => {
    expect(() => buildSessionOptions({ mode: "bogus", cwd: CWD })).toThrow(DriverError);
  });

  it("build mode: acceptEdits, full toolset, canUseTool present, never bypass", () => {
    const options = buildSessionOptions({ mode: "build", cwd: CWD });
    expect(options.permissionMode).toBe("acceptEdits");
    expect(options.tools).toBeUndefined();
    expect(options.disallowedTools).toEqual([]);
    expect(typeof options.canUseTool).toBe("function");
    expect(options.permissionMode).not.toBe("bypassPermissions");
  });

  it("readonly mode: restricted toolset, Write/Edit/Bash disallowed as a second layer", () => {
    const options = buildSessionOptions({ mode: "readonly", cwd: CWD });
    expect(options.permissionMode).toBe("default");
    expect(options.tools).toEqual(["Read", "Grep", "Glob"]);
    expect(options.disallowedTools).toEqual(expect.arrayContaining(["Write", "Edit", "Bash", "NotebookEdit"]));
  });

  it("passes model and effort through when given", () => {
    const options = buildSessionOptions({ mode: "build", cwd: CWD, model: "claude-opus-4-8", effort: "high" });
    expect(options.model).toBe("claude-opus-4-8");
    expect(options.effort).toBe("high");
  });

  it("omits model/effort when not given", () => {
    const options = buildSessionOptions({ mode: "build", cwd: CWD });
    expect(options.model).toBeUndefined();
    expect(options.effort).toBeUndefined();
  });
});

describe("withOutputSchema", () => {
  it("adds a json_schema outputFormat when truthy", () => {
    const options = withOutputSchema({ cwd: CWD }, true);
    expect(options.outputFormat).toEqual({ type: "json_schema", schema: { type: "object" } });
  });

  it("leaves options untouched when falsy", () => {
    const options = withOutputSchema({ cwd: CWD }, false);
    expect(options.outputFormat).toBeUndefined();
  });

  it("passes an exact runner schema through unchanged", () => {
    const schema = { type: "object", required: ["problem"] };
    const options = withOutputSchema({ cwd: CWD }, schema);
    expect(options.outputFormat).toEqual({ type: "json_schema", schema });
  });
});

describe("withSessionIdentity", () => {
  it("uses sessionId for a not-yet-established ref", () => {
    const options = withSessionIdentity({}, { id: "abc", established: false });
    expect(options.sessionId).toBe("abc");
    expect(options.resume).toBeUndefined();
  });

  it("uses resume for an established ref", () => {
    const options = withSessionIdentity({}, { id: "abc", established: true });
    expect(options.resume).toBe("abc");
    expect(options.sessionId).toBeUndefined();
  });

  it("throws without a ref id", () => {
    expect(() => withSessionIdentity({}, { id: "" })).toThrow(DriverError);
  });
});

describe("extractUsage", () => {
  it("normalizes usage + total_cost_usd into the shared shape", () => {
    const usage = extractUsage(
      resultSuccess({ usage: { input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 10 }, total_cost_usd: 0.05 }),
    );
    expect(usage).toEqual({ input: 100, cachedInput: 10, output: 40, costUsd: 0.05 });
  });
});

describe("mapSdkMessageToEvents", () => {
  it("maps system/init to agent.session.init", () => {
    const events = mapSdkMessageToEvents(SYSTEM_INIT);
    expect(events).toEqual([
      { type: "agent.session.init", data: { model: "claude-opus-4-8", permissionMode: "acceptEdits", tools: ["Read", "Write", "Bash"] } },
    ]);
  });

  it("maps assistant text to agent.message", () => {
    expect(mapSdkMessageToEvents(assistantText("hello"))).toEqual([{ type: "agent.message", data: { message: "hello" } }]);
  });

  it("maps assistant Bash tool_use to agent.tool_use with a command field", () => {
    expect(mapSdkMessageToEvents(assistantToolUse("Bash", { command: "pnpm test" }))).toEqual([
      { type: "agent.tool_use", data: { tool: "Bash", command: "pnpm test" } },
    ]);
  });

  it("maps non-Bash tool_use without a command field", () => {
    expect(mapSdkMessageToEvents(assistantToolUse("Read", { file_path: "a.ts" }))).toEqual([
      { type: "agent.tool_use", data: { tool: "Read" } },
    ]);
  });

  it("maps user tool_result (string content) to agent.tool_result", () => {
    expect(mapSdkMessageToEvents(userToolResult("42"))).toEqual([
      { type: "agent.tool_result", data: { isError: false, message: "42" } },
    ]);
  });

  it("maps user tool_result (block-array content) to agent.tool_result", () => {
    expect(mapSdkMessageToEvents(userToolResult([{ type: "text", text: "line1" }, { type: "text", text: "line2" }], true))).toEqual([
      { type: "agent.tool_result", data: { isError: true, message: "line1\nline2" } },
    ]);
  });

  it("maps result to agent.turn.result", () => {
    expect(mapSdkMessageToEvents(resultSuccess())).toEqual([
      { type: "agent.turn.result", data: { subtype: "success", numTurns: 1, isError: false } },
    ]);
  });

  it("ignores unrecognized message types", () => {
    expect(mapSdkMessageToEvents({ type: "rate_limit_event" })).toEqual([]);
    expect(mapSdkMessageToEvents(null as never)).toEqual([]);
  });
});

// DW-1 flight recorder, wired to the real driver here (previously only
// fake.mjs ever fed onRaw — real Claude runs' assistant text, thinking, tool
// inputs and tool results only ever reached the 500/2000-char-truncated
// events.ndjson, never the full-fidelity transcript shard).
describe("mapSdkMessageToRawRecords (DW-1 full-fidelity transcript)", () => {
  it("maps system/init to a system.init record", () => {
    expect(mapSdkMessageToRawRecords(SYSTEM_INIT)).toEqual([
      { kind: "system.init", model: "claude-opus-4-8", permissionMode: "acceptEdits", tools: ["Read", "Write", "Bash"] },
    ]);
  });

  it("maps assistant text to an untruncated assistant.text record", () => {
    expect(mapSdkMessageToRawRecords(assistantText("hello, full fidelity"))).toEqual([
      { kind: "assistant.text", text: "hello, full fidelity" },
    ]);
  });

  it("maps a thinking block to an assistant.reasoning record", () => {
    const message = { type: "assistant", message: { content: [{ type: "thinking", thinking: "working through it" }] } };
    expect(mapSdkMessageToRawRecords(message)).toEqual([{ kind: "assistant.reasoning", text: "working through it" }]);
  });

  it("maps tool_use to a tool.use record with the full (untruncated) input object", () => {
    expect(mapSdkMessageToRawRecords(assistantToolUse("Read", { file_path: "a.ts" }))).toEqual([
      { kind: "tool.use", tool: "Read", input: { file_path: "a.ts" } },
    ]);
  });

  it("maps user tool_result to a tool.result record", () => {
    expect(mapSdkMessageToRawRecords(userToolResult("42"))).toEqual([{ kind: "tool.result", isError: false, output: "42" }]);
    expect(mapSdkMessageToRawRecords(userToolResult("boom", true))).toEqual([
      { kind: "tool.result", isError: true, output: "boom" },
    ]);
  });

  it("maps result to a turn.result record", () => {
    expect(mapSdkMessageToRawRecords(resultSuccess())).toEqual([
      { kind: "turn.result", subtype: "success", numTurns: 1, isError: false },
    ]);
  });

  it("ignores unrecognized message types", () => {
    expect(mapSdkMessageToRawRecords({ type: "rate_limit_event" })).toEqual([]);
    expect(mapSdkMessageToRawRecords(null as never)).toEqual([]);
  });
});

describe("interpretResultMessage", () => {
  it("parses a success result", () => {
    const verdict = interpretResultMessage(resultSuccess({ result: '{"a":1}' }));
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.finalText).toBe('{"a":1}');
      expect(verdict.usage?.input).toBe(100);
    }
  });

  it("reports failure for an error subtype", () => {
    const verdict = interpretResultMessage(resultError());
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toContain("boom");
  });

  it("reports failure for is_error even on subtype success", () => {
    const verdict = interpretResultMessage(resultSuccess({ subtype: "success", is_error: true, errors: ["oops"] }));
    expect(verdict.ok).toBe(false);
  });

  it("reports failure when no result message was seen", () => {
    const verdict = interpretResultMessage(null);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.error).toMatch(/without a result message/);
  });
});

describe("interpretPreflightMessages", () => {
  it("passes on a clean success result", () => {
    expect(interpretPreflightMessages([SYSTEM_INIT, assistantText("OK"), resultSuccess()])).toEqual({ ok: true });
  });

  it("fails on an authentication error surfaced on the assistant message", () => {
    const verdict = interpretPreflightMessages([{ type: "assistant", error: "authentication_failed" }, resultSuccess()]);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("authentication_failed");
  });

  it("fails when the result itself is an error", () => {
    const verdict = interpretPreflightMessages([resultError()]);
    expect(verdict.ok).toBe(false);
  });

  it("fails when no result message ever arrives", () => {
    const verdict = interpretPreflightMessages([SYSTEM_INIT, assistantText("hi")]);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(/no result message/);
  });
});

// ---- createClaudeDriver: wired against an injected fake SDK (no real process, no network) ----

describe("createClaudeDriver: session lifecycle against a fake SDK", () => {
  it("startSession validates mode before ever touching the SDK", async () => {
    const query = vi.fn();
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    await expect(driver.startSession({ cwd: CWD, mode: "bogus" })).rejects.toThrow(DriverError);
    expect(query).not.toHaveBeenCalled();
  });

  it("runs the preflight turn before returning a handle, and throws BLOCKED-style on auth failure", async () => {
    const query = vi.fn().mockReturnValue(asyncGen([{ type: "assistant", error: "authentication_failed" }, resultError()]));
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    await expect(driver.startSession({ cwd: CWD, mode: "build" })).rejects.toThrow(/authentication preflight failed/);
    expect(query).toHaveBeenCalledTimes(1);
    const call = query.mock.calls[0][0];
    expect(call.options.tools).toEqual([]);
    expect(call.options.persistSession).toBe(false);
  });

  it("fails preflight when the SDK query itself is unavailable", async () => {
    const query = vi.fn().mockImplementation(() => {
      throw new Error("authentication unavailable");
    });
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });

    await expect(driver.startSession({ cwd: CWD, mode: "build" })).rejects.toThrow(/authentication preflight failed.*authentication unavailable/);
  });

  it("times out a hung preflight query instead of blocking forever, and aborts the SDK call", async () => {
    vi.useFakeTimers();
    try {
      const query = vi.fn().mockImplementation(
        () =>
          (async function* () {
            await new Promise(() => {}); // never resolves — simulates a hung SDK call
          })(),
      );
      const driver = createClaudeDriver({ importSdk: async () => ({ query }) });

      const pending = driver.startSession({ cwd: CWD, mode: "build" });
      const assertion = expect(pending).rejects.toThrow(/authentication preflight failed/);
      await vi.advanceTimersByTimeAsync(PREFLIGHT_TIMEOUT_MS);
      await assertion;
      const call = query.mock.calls[0][0];
      expect(call.options.abortController.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects starting twice", async () => {
    const query = vi.fn().mockReturnValue(asyncGen([resultSuccess()]));
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    await driver.startSession({ cwd: CWD, mode: "build" });
    await expect(driver.startSession({ cwd: CWD, mode: "build" })).rejects.toThrow(DriverError);
  });

  it("resume requires a ref with an id and never touches the SDK", async () => {
    const query = vi.fn();
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    expect(() => driver.resume(null as never)).toThrow(DriverError);
    const handle = driver.resume({ id: "prior-id", cwd: CWD, mode: "build", established: true });
    expect(handle.ref.id).toBe("prior-id");
    expect(query).not.toHaveBeenCalled();
  });

  it("resume with a mode override switches the effective mode without mutating the ref (BUD-11 root cause #1)", async () => {
    const query = vi
      .fn()
      .mockReturnValueOnce(asyncGen([resultSuccess()])); // the one runTurn call below
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    const ref = { id: "prior-id", cwd: CWD, mode: "readonly", established: true };
    const handle = driver.resume(ref, { mode: "build" });
    expect(handle.mode).toBe("build");
    expect(ref.mode).toBe("readonly"); // the persisted ref itself is never mutated

    await driver.runTurn(handle, "do the build step", {});
    const turnCall = query.mock.calls[0][0];
    expect(turnCall.options.permissionMode).toBe("acceptEdits"); // build mode, not the ref's stale readonly
    expect(turnCall.options.disallowedTools).toEqual([]);
  });

  it("resume without an override falls back to the ref's own mode", () => {
    const driver = createClaudeDriver({ importSdk: async () => ({ query: vi.fn() }) });
    const handle = driver.resume({ id: "prior-id", cwd: CWD, mode: "readonly", established: true });
    expect(handle.mode).toBe("readonly");
  });

  it("rejects an empty resume id before touching the SDK", () => {
    const query = vi.fn();
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });

    expect(() => driver.resume({ id: "", cwd: CWD, mode: "build" })).toThrow(/resume requires a ref with an id/);
    expect(query).not.toHaveBeenCalled();
  });

  it("runTurn before start/resume throws", async () => {
    const driver = createClaudeDriver({ importSdk: async () => ({ query: vi.fn() }) });
    await expect(driver.runTurn({} as never, "go")).rejects.toThrow(DriverError);
  });

  it("runTurn rejects an empty prompt", async () => {
    const query = vi.fn().mockReturnValue(asyncGen([resultSuccess()]));
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    await driver.startSession({ cwd: CWD, mode: "build" });
    await expect(driver.runTurn({} as never, "   ")).rejects.toThrow(DriverError);
  });
});

describe("createClaudeDriver: turn mechanics (sessionId vs resume, events, usage)", () => {
  it("first turn uses sessionId, later turns resume the same id; onEvent fires in order", async () => {
    const preflightMessages = asyncGen([resultSuccess()]);
    const turn1Messages = asyncGen([SYSTEM_INIT, assistantText("working"), userToolResult("ok"), resultSuccess({ result: "turn1" })]);
    const turn2Messages = asyncGen([assistantText("still working"), resultSuccess({ result: "turn2" })]);
    const query = vi
      .fn()
      .mockReturnValueOnce(preflightMessages)
      .mockReturnValueOnce(turn1Messages)
      .mockReturnValueOnce(turn2Messages);
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });

    const handle = await driver.startSession({ cwd: CWD, mode: "build", model: "claude-opus-4-8" });
    expect(handle.ref.established).toBe(false);

    const seen: unknown[] = [];
    const r1 = await driver.runTurn(handle, "do the thing", { onEvent: (e: unknown) => seen.push(e) });
    expect(r1.finalText).toBe("turn1");
    expect(r1.usage).toEqual({ input: 100, cachedInput: 10, output: 40, costUsd: 0.01 });
    expect(seen).toEqual([
      { type: "agent.session.init", data: { model: "claude-opus-4-8", permissionMode: "acceptEdits", tools: ["Read", "Write", "Bash"] } },
      { type: "agent.message", data: { message: "working" } },
      { type: "agent.tool_result", data: { isError: false, message: "ok" } },
      { type: "agent.turn.result", data: { subtype: "success", numTurns: 1, isError: false } },
    ]);
    expect(handle.ref.established).toBe(true);

    const turn1Call = query.mock.calls[1][0];
    expect(turn1Call.options.sessionId).toBe(handle.ref.id);
    expect(turn1Call.options.resume).toBeUndefined();

    await driver.runTurn(handle, "continue", {});
    const turn2Call = query.mock.calls[2][0];
    expect(turn2Call.options.resume).toBe(handle.ref.id);
    expect(turn2Call.options.sessionId).toBeUndefined();
  });

  it("feeds onRaw with full-fidelity records alongside onEvent (DW-1)", async () => {
    const query = vi
      .fn()
      .mockReturnValueOnce(asyncGen([resultSuccess()]))
      .mockReturnValueOnce(
        asyncGen([
          SYSTEM_INIT,
          assistantText("working"),
          assistantToolUse("Read", { file_path: "a.ts" }),
          userToolResult("file contents"),
          resultSuccess({ result: "done" }),
        ]),
      );
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });

    const rawRecords: unknown[] = [];
    await driver.runTurn(handle, "go read a.ts", { onRaw: (r: unknown) => rawRecords.push(r) });

    expect(rawRecords).toEqual([
      { kind: "system.init", model: "claude-opus-4-8", permissionMode: "acceptEdits", tools: ["Read", "Write", "Bash"] },
      { kind: "assistant.text", text: "working" },
      { kind: "tool.use", tool: "Read", input: { file_path: "a.ts" } },
      { kind: "tool.result", isError: false, output: "file contents" },
      { kind: "turn.result", subtype: "success", numTurns: 1, isError: false },
    ]);
  });

  it("requests structured JSON output when outputSchema is truthy", async () => {
    const query = vi
      .fn()
      .mockReturnValueOnce(asyncGen([resultSuccess()]))
      .mockReturnValueOnce(asyncGen([SYSTEM_INIT, resultSuccess({ result: '{"ok":true}' })]));
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });
    await driver.runTurn(handle, "write spec.json", { outputSchema: true });
    const turnCall = query.mock.calls[1][0];
    expect(turnCall.options.outputFormat).toEqual({ type: "json_schema", schema: { type: "object" } });
  });

  it("throws a DriverError when the turn result is an error, after still emitting prior events", async () => {
    const query = vi
      .fn()
      .mockReturnValueOnce(asyncGen([resultSuccess()]))
      .mockReturnValueOnce(asyncGen([assistantText("trying"), resultError()]));
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "build" });
    const seen: unknown[] = [];
    await expect(driver.runTurn(handle, "go", { onEvent: (e: unknown) => seen.push(e) })).rejects.toThrow(/turn failed/);
    expect(seen.length).toBeGreaterThan(0);
  });

  it("wraps a query() iteration failure as a DriverError", async () => {
    const query = vi.fn().mockReturnValueOnce(asyncGen([resultSuccess()])).mockReturnValueOnce(
      (async function* () {
        throw new Error("network exploded");
      })(),
    );
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "build" });
    await expect(driver.runTurn(handle, "go")).rejects.toThrow(/query failed/);
  });

  it("DW-10: wires signal onto Options.abortController and throws DriverAbortedError when it fires mid-turn", async () => {
    const externalController = new AbortController();
    let seenAbortController: AbortController | undefined;
    const query = vi
      .fn()
      .mockReturnValueOnce(asyncGen([resultSuccess()]))
      .mockImplementationOnce((call: { options: { abortController: AbortController } }) => {
        seenAbortController = call.options.abortController;
        return (async function* () {
          yield SYSTEM_INIT;
          externalController.abort(); // owner requests abort mid-stream
          if (seenAbortController?.signal.aborted) throw new Error("aborted");
          yield resultSuccess();
        })();
      });
    const driver = createClaudeDriver({ importSdk: async () => ({ query }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "build" });
    await expect(driver.runTurn(handle, "go", { signal: externalController.signal })).rejects.toThrow(DriverAbortedError);
    expect(seenAbortController).toBeInstanceOf(AbortController);
  });
});
