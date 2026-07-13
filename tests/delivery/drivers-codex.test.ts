import { describe, expect, it, vi } from "vitest";

import { DriverError } from "../../scripts/delivery/drivers/driver.mjs";
import {
  buildThreadOptions,
  createCodexDriver,
  mapCodexEventToEvents,
  toTurnOptions,
} from "../../scripts/delivery/drivers/codex.mjs";

const CWD = "/repo";

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

describe("createCodexDriver", () => {
  it("runs an authentication preflight and persists the SDK thread id", async () => {
    const thread = { id: "thread-1", run: vi.fn().mockResolvedValue({ finalResponse: "OK" }), runStreamed: vi.fn() };
    const startThread = vi.fn().mockReturnValue(thread);
    const driver = createCodexDriver({ importSdk: async () => createSdk({ startThread }) });

    const handle = await driver.startSession({ cwd: CWD, mode: "build" });

    expect(thread.run).toHaveBeenCalledWith("Reply with exactly: OK");
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
});
