import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { probeCodexModels } from "../../scripts/delivery-v2/probes/codex-models.mjs";

type Message = { method: string; id?: string; params: Record<string, unknown> };
type Reply = (message: Message, respond: (result: unknown) => void, child: ReturnType<typeof fakeChild>) => void;
function fakeChild(onWrite: (text: string) => void, closeOnKill = true) {
  const child = Object.assign(new EventEmitter(), {
    pid: 7, stdout: new PassThrough(), stderr: new PassThrough(),
    stdin: new Writable({ write(chunk, _encoding, done) { queueMicrotask(() => onWrite(String(chunk))); done(); } }),
    kill: vi.fn((_signal?: string) => { if (closeOnKill) queueMicrotask(() => child.emit("close", 0, null)); return true; }),
  });
  return child;
}
const selection = { model: "gpt-6-luna", effort: "low", expectedNativeVersion: "0.144.1" };
const ready = { method: "chatgpt", additionalSpendAllowed: false, includedUsageAvailable: true };
const modelRow = { id: "gpt-6-luna", model: "gpt-6-luna", supportedReasoningEfforts: [{ reasoningEffort: "low", description: "private-description" }] };

function fixture(reply?: Reply, { version = "codex-cli 0.144.1", closeOnKill = true, account = { type: "chatgpt", planType: "pro", email: "private@example.invalid" }, accountDelayMs = 0 } = {}) {
  const requests: Message[] = [], children: ReturnType<typeof fakeChild>[] = [];
  const prepare = vi.fn(async () => ({ ...ready, usageSnapshot: { secret: "private-usage" } }));
  const spawnFn = vi.fn((_command: string, args: string[]) => {
    const child = fakeChild(text => {
      const message = JSON.parse(text) as Message;
      requests.push(message);
      const respond = (result: unknown) => child.stdout.write(JSON.stringify({ id: message.id, result }) + "\n");
      if (message.method === "initialize") respond({ platformOs: "linux" });
      else if (message.method === "account/read") {
        const answer = () => respond({ account, requiresOpenaiAuth: true });
        if (accountDelayMs) setTimeout(answer, accountDelayMs); else answer();
      }
      else if (message.method === "model/list") {
        if (reply) reply(message, respond, child);
        else respond({ data: [modelRow], nextCursor: null });
      }
    }, args[0] === "--version" || closeOnKill);
    children.push(child);
    if (args[0] === "--version") queueMicrotask(() => child.stdout.write(version + "\n"));
    return child;
  });
  const run = (limits: Record<string, number> = {}, onProgress?: (event: object) => void) => probeCodexModels({ ...selection, prepareSubscription: prepare, spawnFn, limits, onProgress });
  return { requests, prepare, spawnFn, children, run };
}

afterEach(() => vi.useRealTimers());

describe("bounded native Codex model catalog diagnostic", () => {
  it("uses only initialization/account/model RPCs and emits exact advertised selection without claiming entitlement", async () => {
    const f = fixture();
    const result = await f.run();
    expect(result).toMatchObject({ ok: true, nativeVersion: "0.144.1", model: "gpt-6-luna", effort: "low", modelAdvertised: true, effortAdvertised: true, entitlement: "unverified", providerTurns: 0, cleanupConfirmed: true, account: { type: "chatgpt", planType: "pro" } });
    expect(f.requests.map(row => row.method)).toEqual(["initialize", "initialized", "account/read", "model/list"]);
    expect(f.requests[2].params).toEqual({ refreshToken: false });
    expect(f.requests[3].params).toEqual({ limit: 100, includeHidden: true, cursor: null });
    expect(f.prepare).toHaveBeenCalledExactlyOnceWith("codex-exec-sdk");
    expect(JSON.stringify(result)).not.toMatch(/private-|private@/u);
    expect(f.children.every(child => child.kill.mock.calls.length === 1)).toBe(true);
  });

  it("follows a bounded cursor to the exact model without substituting an alias or upgrade", async () => {
    const f = fixture((message, respond) => respond(message.params.cursor === null
      ? { data: [{ ...modelRow, model: "gpt-6.1-sol", upgrade: "gpt-6-luna" }], nextCursor: "next" }
      : { data: [modelRow], nextCursor: null }));
    expect(await f.run()).toMatchObject({ ok: true, pages: 2 });
    expect(f.requests.at(-1)?.params.cursor).toBe("next");
  });

  it.each([
    [{ data: [{ ...modelRow, model: "different" }], nextCursor: null }, "native-model-not-advertised"],
    [{ data: [{ ...modelRow, supportedReasoningEfforts: [{ reasoningEffort: "medium" }] }], nextCursor: null }, "native-effort-not-advertised"],
    [{ data: [{ ...modelRow, supportedReasoningEfforts: null }], nextCursor: null }, "native-efforts-unknown"],
    [{ data: [modelRow, modelRow], nextCursor: null }, "native-catalog-ambiguous"],
    [{ data: null }, "native-catalog-invalid"],
  ])("refuses unavailable or malformed selection %#", async (response, code) => {
    expect(await fixture((_message, respond) => respond(response)).run()).toMatchObject({ ok: false, code, entitlement: "unverified", cleanupConfirmed: true });
  });

  it("refuses unknown/paid subscription proof before starting app-server", async () => {
    const f = fixture();
    f.prepare.mockResolvedValueOnce({ ...ready, additionalSpendAllowed: true, usageSnapshot: { secret: "private-usage" } });
    expect(await f.run()).toMatchObject({ ok: false, code: "subscription-not-proven" });
    expect(f.spawnFn).toHaveBeenCalledTimes(1);
  });

  it("does not expose subscription errors or accept a different native account", async () => {
    const f = fixture(); f.prepare.mockRejectedValueOnce(new Error("private-token"));
    const result = await f.run();
    expect(result).toMatchObject({ ok: false, code: "subscription-unavailable" });
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(await fixture(undefined, { account: { type: "apiKey", planType: "pro", email: "private@example.invalid" } }).run()).toMatchObject({ ok: false, code: "native-subscription-mismatch" });
  });

  it("refuses a mismatched native version before touching subscription authentication", async () => {
    const f = fixture(undefined, { version: "codex-cli 0.145.0" });
    expect(await f.run()).toMatchObject({ ok: false, code: "native-version-mismatch", nativeVersion: "0.145.0" });
    expect(f.prepare).not.toHaveBeenCalled();
  });

  it("bounds pagination and refuses repeated cursors", async () => {
    const f = fixture((_message, respond) => respond({ data: [], nextCursor: "next" }));
    expect(await f.run()).toMatchObject({ ok: false, code: "native-cursor-invalid", pages: 2 });
    const g = fixture((message, respond) => respond({ data: [], nextCursor: String(message.id) }));
    expect(await g.run({ maxPages: 2 })).toMatchObject({ ok: false, code: "native-catalog-page-limit", pages: 2 });
    expect(g.requests.filter(row => row.method === "model/list")).toHaveLength(2);
  });

  it("refuses server requests and malformed output without replying or retaining their content", async () => {
    for (const line of [JSON.stringify({ id: "private-secret", method: "account/chatgptAuthTokens/refresh" }), "not-json private-secret"]) {
      const f = fixture((_message, _respond, child) => child.stdout.write(line + "\n"));
      const result = await f.run();
      expect(result.ok).toBe(false);
      expect(result.cleanupConfirmed).toBe(true);
      expect(JSON.stringify(result)).not.toContain("private-secret");
      expect(f.requests).toHaveLength(4);
    }
  });

  it("limits stdout/stderr bytes and terminates an unresponsive native process", async () => {
    const f = fixture((_message, _respond, child) => child.stderr.write("private".repeat(500)));
    expect(await f.run({ maxBytes: 2048 })).toMatchObject({ ok: false, code: "native-output-limit", cleanupConfirmed: true });
    const g = fixture(() => {});
    expect(await g.run({ timeoutMs: 10 })).toMatchObject({ ok: false, code: "native-probe-timeout", cleanupConfirmed: true });
  });

  it("allows account and catalog latency beyond the old ten-second override without retrying", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const f = fixture((_message, respond) => setTimeout(() => respond({ data: [modelRow], nextCursor: null }), 6_000), { accountDelayMs: 4_876 });
    const pending = f.run();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(f.requests.map(row => row.method)).toEqual(["initialize", "initialized", "account/read", "model/list"]);
    expect(f.children[1].kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(876);
    expect(await pending).toMatchObject({ ok: true, code: "native-selection-advertised", cleanupConfirmed: true, providerTurns: 0, diagnostics: { elapsedMs: 10_876 } });
    expect(f.spawnFn).toHaveBeenCalledTimes(2);
    expect(f.prepare).toHaveBeenCalledTimes(1);
    expect(f.requests.filter(row => row.method === "model/list")).toHaveLength(1);
  });

  it("still stops an unresponsive catalog at the thirty-second session bound", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const f = fixture(() => {}, { accountDelayMs: 4_876 });
    const pending = f.run();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.children[1].kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ ok: false, code: "native-probe-timeout", cleanupConfirmed: true, providerTurns: 0, diagnostics: { elapsedMs: 30_000 } });
    expect(f.children[1].kill).toHaveBeenCalledExactlyOnceWith("SIGTERM");
    expect(f.spawnFn).toHaveBeenCalledTimes(2);
    expect(f.requests.filter(row => row.method === "model/list")).toHaveLength(1);
  });

  it("retains only bounded RPC timings and fixed stderr signals when model listing stalls", async () => {
    const f = fixture((_message, _respond, child) => child.stderr.write("private-token failed to refresh models: connection reset; HTTP 403"));
    const result = await f.run({ timeoutMs: 10 });
    expect(result).toMatchObject({ ok: false, code: "native-probe-timeout", providerTurns: 0, cleanupConfirmed: true,
      diagnostics: { elapsedMs: expect.any(Number), stderrSignals: ["connection", "forbidden", "modelRefresh"],
        rpcStages: [
          { method: "initialize", startedAt: expect.any(String), completedAt: expect.any(String) },
          { method: "account/read", startedAt: expect.any(String), completedAt: expect.any(String) },
          { method: "model/list", startedAt: expect.any(String), completedAt: null },
        ] } });
    expect(JSON.stringify(result)).not.toMatch(/private-token|HTTP 403|connection reset/u);
    expect(f.requests.map(row => row.method)).toEqual(["initialize", "initialized", "account/read", "model/list"]);
  });

  it("records completion of a successful native catalog response without retaining payload fields", async () => {
    const result = await fixture().run();
    expect(result).toMatchObject({ ok: true, diagnostics: { stderrSignals: [], rpcStages: [
      { method: "initialize", completedAt: expect.any(String) },
      { method: "account/read", completedAt: expect.any(String) },
      { method: "model/list", completedAt: expect.any(String) },
    ] } });
    expect(JSON.stringify(result)).not.toMatch(/private-|private@/u);
  });

  it("never publishes success without observed process termination", async () => {
    const f = fixture(undefined, { closeOnKill: false });
    expect(await f.run({ cleanupMs: 5 })).toMatchObject({ ok: false, code: "native-cleanup-unconfirmed", cleanupConfirmed: false,
      diagnostics: { stopCode: "native-selection-advertised", sigtermRequested: true, sigkillRequested: true, closeObserved: false } });
    expect(f.children[1].kill.mock.calls.map(row => row[0])).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("refuses any increase to the fixed probe envelope", async () => {
    const f = fixture();
    expect(await f.run({ maxPages: 6 })).toMatchObject({ ok: false, code: "probe-limit-invalid" });
    expect(f.spawnFn).not.toHaveBeenCalled();
  });
  it("emits redacted stage progress before a stalled subscription read and completes without changing the verdict", async () => {
    const f = fixture(), progress: object[] = [];
    let release!: () => void;
    f.prepare.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ ...ready, usageSnapshot: { secret: "private-usage" } }); }));
    const pending = f.run({}, event => progress.push(event));
    await vi.waitFor(() => expect(progress).toEqual([
      { stage: "version", event: "started", at: expect.any(String) },
      { stage: "version", event: "completed", at: expect.any(String), code: "native-version-observed", nativeVersion: "0.144.1", cleanupConfirmed: true },
      { stage: "subscription", event: "started", at: expect.any(String) },
    ]));
    expect(f.spawnFn).toHaveBeenCalledTimes(1);
    release();
    expect(await pending).toMatchObject({ ok: true, cleanupConfirmed: true, providerTurns: 0 });
    expect(progress).toContainEqual({ stage: "model/list", event: "completed", at: expect.any(String) });
    expect(JSON.stringify(progress)).not.toMatch(/private|usageSnapshot/u);
    expect(await fixture().run({}, () => { throw new Error("diagnostic sink unavailable"); })).toMatchObject({ ok: true });
  });
});
