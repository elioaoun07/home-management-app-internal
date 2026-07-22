import { describe, expect, it, vi } from "vitest";

import { DriverAbortedError, DriverError } from "../../scripts/delivery/drivers/driver.mjs";
import {
  buildThreadOptions,
  createCodexDriver,
  manifest,
  mapCodexEventToEvents,
  mapCodexEventToRawRecords,
  PREFLIGHT_TIMEOUT_MS,
  toTurnOptions,
  withAbortSignal,
} from "../../scripts/delivery/drivers/codex.mjs";

const CWD = "/repo";

describe("manifest (DW-2, pure data, no SDK import)", () => {
  it("declares the codex capability surface", () => {
    const m = manifest();
    expect(m.provider).toBe("codex");
    expect(m.efforts).toEqual(["minimal", "low", "medium", "high", "xhigh"]);
    expect(m.supportsNativeFork).toBe(false);
    expect(m.usage).toEqual({ cacheCreation: false, reasoning: true, costReported: false });
  });

  it("is exposed on the driver instance without touching the SDK", () => {
    const driver = createCodexDriver({ importSdk: async () => { throw new Error("must not be called"); } });
    expect(driver.manifest()).toEqual(manifest());
  });

  it("declares abort support (DW-10)", () => {
    expect(manifest().supportsAbort).toBe(true);
  });
});

describe("withAbortSignal (DW-10)", () => {
  it("passes the signal through unchanged (TurnOptions.signal)", () => {
    const controller = new AbortController();
    expect(withAbortSignal({ outputSchema: { type: "object" } }, controller.signal)).toEqual({
      outputSchema: { type: "object" },
      signal: controller.signal,
    });
  });

  it("leaves options untouched when no signal is given", () => {
    expect(withAbortSignal({ outputSchema: { type: "object" } }, undefined)).toEqual({ outputSchema: { type: "object" } });
  });
});

async function* stream(events: object[]) {
  yield* events;
}

function createSdk({ startThread, resumeThread }: { startThread?: ReturnType<typeof vi.fn>; resumeThread?: ReturnType<typeof vi.fn> }) {
  return {
    Codex: class {
      startThread = startThread;
      resumeThread = resumeThread;
    },
  };
}

describe("buildThreadOptions", () => {
  it("uses a network-off, approval-never workspace sandbox in build mode", () => {
    expect(buildThreadOptions({ cwd: CWD, mode: "build", model: "gpt-5.4", effort: "high" })).toEqual({
      workingDirectory: CWD,
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      model: "gpt-5.4",
      modelReasoningEffort: "high",
    });
  });

  it("uses the read-only sandbox for analysis phases", () => {
    expect(buildThreadOptions({ cwd: CWD, mode: "readonly" }).sandboxMode).toBe("read-only");
  });

  it("rejects unknown modes", () => {
    expect(() => buildThreadOptions({ cwd: CWD, mode: "other" })).toThrow(DriverError);
  });
});

describe("toTurnOptions", () => {
  it("adds the permissive JSON schema only when requested", () => {
    expect(toTurnOptions(true)).toEqual({ outputSchema: { type: "object" } });
    expect(toTurnOptions(false)).toEqual({});
  });

  it("passes an exact runner schema through unchanged", () => {
    const schema = { type: "object", required: ["problem"] };
    expect(toTurnOptions(schema)).toEqual({ outputSchema: schema });
  });
});

describe("mapCodexEventToEvents", () => {
  it("normalizes session, message, command, file-change, completion, and failure events", () => {
    expect(mapCodexEventToEvents({ type: "thread.started", thread_id: "thread-1" })).toEqual([
      { type: "agent.session.init", data: { threadId: "thread-1" } },
    ]);
    expect(mapCodexEventToEvents({ type: "item.completed", item: { type: "agent_message", text: "hello" } })).toEqual([
      { type: "agent.message", data: { message: "hello" } },
    ]);
    expect(
      mapCodexEventToEvents({
        type: "item.completed",
        item: { type: "command_execution", command: "pnpm test", aggregated_output: "ok", status: "completed", exit_code: 0 },
      }),
    ).toEqual([{ type: "agent.command", data: { command: "pnpm test", output: "ok", status: "completed", exitCode: 0 } }]);
    expect(
      mapCodexEventToEvents({ type: "item.completed", item: { type: "file_change", status: "completed", changes: [{ path: "a.ts", kind: "update" }] } }),
    ).toEqual([{ type: "agent.file_change", data: { status: "completed", changes: [{ path: "a.ts", kind: "update" }] } }]);
    expect(mapCodexEventToEvents({ type: "turn.completed", usage: { input_tokens: 4, cached_input_tokens: 1, output_tokens: 2 } })).toEqual([
      { type: "agent.turn.result", data: { usage: { input: 4, cachedInput: 1, output: 2, costUsd: null } } },
    ]);
    expect(mapCodexEventToEvents({ type: "turn.failed", error: { message: "no auth" } })).toEqual([
      { type: "agent.turn.failed", data: { message: "no auth" } },
    ]);
  });
});

// DW-1 flight recorder, wired to the real driver here (previously only
// fake.mjs ever fed onRaw — real Codex runs' assistant text, reasoning, tool
// calls and results only ever reached the truncated events.ndjson, never the
// full-fidelity transcript shard).
describe("mapCodexEventToRawRecords (DW-1 full-fidelity transcript)", () => {
  it("normalizes session, message, reasoning, command, file-change, mcp, and completion events", () => {
    expect(mapCodexEventToRawRecords({ type: "thread.started", thread_id: "thread-1" })).toEqual([
      { kind: "system.init", threadId: "thread-1" },
    ]);
    expect(mapCodexEventToRawRecords({ type: "item.completed", item: { type: "agent_message", text: "hello" } })).toEqual([
      { kind: "assistant.text", text: "hello" },
    ]);
    expect(mapCodexEventToRawRecords({ type: "item.completed", item: { type: "reasoning", text: "thinking it through" } })).toEqual([
      { kind: "assistant.reasoning", text: "thinking it through" },
    ]);
    expect(
      mapCodexEventToRawRecords({
        type: "item.completed",
        item: { type: "command_execution", command: "pnpm test", aggregated_output: "ok", status: "completed", exit_code: 0 },
      }),
    ).toEqual([{ kind: "command", command: "pnpm test", output: "ok", status: "completed", exitCode: 0 }]);
    expect(
      mapCodexEventToRawRecords({
        type: "item.completed",
        item: { type: "file_change", status: "completed", changes: [{ path: "a.ts", kind: "update" }] },
      }),
    ).toEqual([{ kind: "file.change", status: "completed", changes: [{ path: "a.ts", kind: "update" }] }]);
    expect(
      mapCodexEventToRawRecords({
        type: "item.completed",
        item: { type: "mcp_tool_call", server: "linear", tool: "create_issue", status: "completed" },
      }),
    ).toEqual([{ kind: "tool.use", tool: "linear.create_issue", status: "completed" }]);
    expect(
      mapCodexEventToRawRecords({ type: "turn.completed", usage: { input_tokens: 4, cached_input_tokens: 1, output_tokens: 2 } }),
    ).toEqual([{ kind: "turn.result", usage: { input: 4, cachedInput: 1, output: 2, costUsd: null } }]);
    expect(mapCodexEventToRawRecords({ type: "turn.failed", error: { message: "no auth" } })).toEqual([
      { kind: "error", text: "no auth" },
    ]);
  });

  it("ignores unrecognized events", () => {
    expect(mapCodexEventToRawRecords({ type: "session.status_running" })).toEqual([]);
    expect(mapCodexEventToRawRecords(null as never)).toEqual([]);
  });
});

describe("createCodexDriver", () => {
  it("runs an authentication preflight and persists the SDK thread id", async () => {
    const thread = { id: "thread-1", run: vi.fn().mockResolvedValue({ finalResponse: "OK" }), runStreamed: vi.fn() };
    const startThread = vi.fn().mockReturnValue(thread);
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread }) });

    const handle = await driver.startSession({ cwd: CWD, mode: "build" });

    expect(thread.run).toHaveBeenCalledWith("Reply with exactly: OK", { signal: expect.any(AbortSignal) });
    expect(startThread).toHaveBeenCalledWith(expect.objectContaining({ sandboxMode: "workspace-write", approvalPolicy: "never", networkAccessEnabled: false }));
    expect(handle.ref).toMatchObject({ id: "thread-1", cwd: CWD, mode: "build" });
  });

  it("fails preflight cleanly when authentication or SDK startup fails", async () => {
    const thread = { id: null, run: vi.fn().mockRejectedValue(new Error("authentication failed")), runStreamed: vi.fn() };
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });
    await expect(driver.startSession({ cwd: CWD, mode: "build" })).rejects.toThrow(/authentication preflight failed/);
  });

  it("fails preflight when the SDK never establishes a thread", async () => {
    const thread = { id: null, run: vi.fn().mockResolvedValue({ finalResponse: "OK" }), runStreamed: vi.fn() };
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });

    await expect(driver.startSession({ cwd: CWD, mode: "build" })).rejects.toThrow(/did not establish a thread id/);
    expect(thread.run).toHaveBeenCalledOnce();
  });

  it("times out a hung preflight run instead of blocking forever, and aborts the SDK call", async () => {
    vi.useFakeTimers();
    try {
      let capturedSignal: AbortSignal | undefined;
      const thread = {
        id: "thread-1",
        run: vi.fn((_input, opts) => {
          capturedSignal = opts && opts.signal;
          return new Promise(() => {}); // never resolves — simulates a hung SDK call
        }),
        runStreamed: vi.fn(),
      };
      const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });

      const pending = driver.startSession({ cwd: CWD, mode: "build" });
      const assertion = expect(pending).rejects.toThrow(/authentication preflight failed/);
      await vi.advanceTimersByTimeAsync(PREFLIGHT_TIMEOUT_MS);
      await assertion;
      expect(capturedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an invalid resume reference before touching the SDK", async () => {
    const importSdk = vi.fn();
    const driver = createCodexDriver({ importSdk });

    await expect(driver.resume({ id: "", cwd: CWD, mode: "build" })).rejects.toThrow(/resume requires a ref with an id/);
    expect(importSdk).not.toHaveBeenCalled();
  });

  it("resumes the stored thread ref without running preflight again", async () => {
    const thread = { run: vi.fn(), runStreamed: vi.fn() };
    const resumeThread = vi.fn().mockReturnValue(thread);
    const driver = createCodexDriver({ importSdk: async () => createSdk({ resumeThread }) });
    const handle = await driver.resume({ id: "thread-old", cwd: CWD, mode: "readonly", model: "gpt-5.4", effort: "low" });

    expect(resumeThread).toHaveBeenCalledWith("thread-old", expect.objectContaining({ sandboxMode: "read-only" }));
    expect(thread.run).not.toHaveBeenCalled();
    expect(handle.ref.id).toBe("thread-old");
  });

  it("resume with a mode override switches sandboxMode without mutating the ref (BUD-11 root cause #1)", async () => {
    const thread = { run: vi.fn(), runStreamed: vi.fn() };
    const resumeThread = vi.fn().mockReturnValue(thread);
    const driver = createCodexDriver({ importSdk: async () => createSdk({ resumeThread }) });
    const ref = { id: "thread-old", cwd: CWD, mode: "readonly", model: null, effort: null };

    const handle = await driver.resume(ref, { mode: "build" });

    expect(resumeThread).toHaveBeenCalledWith("thread-old", expect.objectContaining({ sandboxMode: "workspace-write" }));
    expect(handle.mode).toBe("build");
    expect(ref.mode).toBe("readonly"); // the persisted ref itself is never mutated
  });

  it("streams normalized events, structured output, final text, and normalized usage", async () => {
    const thread = {
      id: "thread-1",
      run: vi.fn().mockResolvedValue({ finalResponse: "OK" }),
      runStreamed: vi.fn().mockResolvedValue({
        events: stream([
          { type: "turn.started" },
          { type: "item.completed", item: { type: "agent_message", text: '{"ok":true}' } },
          { type: "turn.completed", usage: { input_tokens: 11, cached_input_tokens: 3, output_tokens: 5 } },
        ]),
      }),
    };
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });
    const events: object[] = [];

    const result = await driver.runTurn(handle, "return JSON", { outputSchema: true, onEvent: (event: object) => events.push(event) });

    expect(thread.runStreamed).toHaveBeenCalledWith("return JSON", { outputSchema: { type: "object" } });
    expect(events).toEqual([
      { type: "agent.turn.started", data: {} },
      { type: "agent.message", data: { message: '{"ok":true}' } },
      { type: "agent.turn.result", data: { usage: { input: 11, cachedInput: 3, output: 5, costUsd: null } } },
    ]);
    expect(result).toEqual({ finalText: '{"ok":true}', usage: { input: 11, cachedInput: 3, output: 5, costUsd: null } });
  });

  it("feeds onRaw with full-fidelity records alongside onEvent (DW-1)", async () => {
    const thread = {
      id: "thread-1",
      run: vi.fn().mockResolvedValue({ finalResponse: "OK" }),
      runStreamed: vi.fn().mockResolvedValue({
        events: stream([
          { type: "item.completed", item: { type: "agent_message", text: "hello" } },
          { type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } },
        ]),
      }),
    };
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });

    const rawRecords: unknown[] = [];
    await driver.runTurn(handle, "say hello", { onRaw: (r: unknown) => rawRecords.push(r) });

    expect(rawRecords).toEqual([
      { kind: "assistant.text", text: "hello" },
      { kind: "turn.result", usage: { input: 1, cachedInput: 0, output: 1, costUsd: null } },
    ]);
  });

  it("resumes the thread with a per-turn effort override", async () => {
    const resumedThread = {
      runStreamed: vi.fn().mockResolvedValue({
        events: stream([{ type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } }]),
      }),
    };
    const initialThread = { id: "thread-1", run: vi.fn().mockResolvedValue({ finalResponse: "OK" }), runStreamed: vi.fn() };
    const startThread = vi.fn().mockReturnValue(initialThread);
    const resumeThread = vi.fn().mockReturnValue(resumedThread);
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread, resumeThread }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "build", effort: "low" });

    await driver.runTurn(handle, "continue", { effort: "high" });

    expect(resumeThread).toHaveBeenCalledWith("thread-1", expect.objectContaining({ modelReasoningEffort: "high" }));
    expect(handle.ref.effort).toBe("high");
  });

  it("throws after forwarding a terminal turn failure", async () => {
    const thread = {
      id: "thread-1",
      run: vi.fn().mockResolvedValue({ finalResponse: "OK" }),
      runStreamed: vi.fn().mockResolvedValue({ events: stream([{ type: "turn.failed", error: { message: "quota exhausted" } }]) }),
    };
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "build" });
    await expect(driver.runTurn(handle, "go")).rejects.toThrow(/quota exhausted/);
  });

  it("wraps an SDK stream failure as a DriverError", async () => {
    const thread = {
      id: "thread-1",
      run: vi.fn().mockResolvedValue({ finalResponse: "OK" }),
      runStreamed: vi.fn().mockRejectedValue(new Error("connection reset")),
    };
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "build" });

    await expect(driver.runTurn(handle, "go")).rejects.toThrow(/stream failed.*connection reset/);
  });

  it("DW-10: forwards signal into TurnOptions and throws DriverAbortedError when the stream fails post-abort", async () => {
    const controller = new AbortController();
    const runStreamed = vi.fn().mockImplementation(() => {
      controller.abort(); // simulate the SDK reacting to the signal mid-call
      return Promise.reject(new Error("aborted by signal"));
    });
    const thread = { id: "thread-1", run: vi.fn().mockResolvedValue({ finalResponse: "OK" }), runStreamed };
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread: vi.fn().mockReturnValue(thread) }) });
    const handle = await driver.startSession({ cwd: CWD, mode: "build" });

    await expect(driver.runTurn(handle, "go", { signal: controller.signal })).rejects.toThrow(DriverAbortedError);
    expect(runStreamed).toHaveBeenCalledWith("go", { signal: controller.signal });
  });
});
