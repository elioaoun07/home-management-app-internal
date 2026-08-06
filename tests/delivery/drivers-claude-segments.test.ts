// tests/delivery/drivers-claude-segments.test.ts
//
// DLV-85 — persistent SDK session segments.
//
// WHAT THIS PROTECTS. Before DLV-85 the Claude driver opened a fresh `query()`
// for every runner turn, so a 13-turn session produced 13 cold prompt caches
// (verified on s-20260725-181118-xdl9: 13 turn results, 13 `agent.session.init`
// events, exactly 1:1). Each re-wrote the whole conversation prefix at the
// 1-hour cache-write rate — 2x input — and read it back only inside that turn.
// Measured cacheWrite:cacheRead across the instrumented sessions was 1 : 1.5,
// and cache writes were 87% of one session's entire bill.
//
// The economically load-bearing assertion in this file is simply
// `expect(query).toHaveBeenCalledTimes(1)` after several same-mode turns. If a
// future change reverts to one query() per turn, that assertion fails — which
// is the point, because the regression is otherwise completely silent: every
// turn still succeeds, only the bill changes.
//
// The subtlest trap it guards is the drain loop. Reading the generator with
// `for await (const m of stream) { ...; break }` calls the generator's
// `return()` on break, destroying the live session. The driver therefore uses
// a manual `.next()` loop; "does not close the generator between turns" below
// fails if anyone reintroduces `for await`.

import { describe, expect, it, vi } from "vitest";
import { DriverAbortedError } from "../../scripts/delivery/drivers/driver.mjs";
import { createClaudeDriver, createInputStream, segmentKey } from "../../scripts/delivery/drivers/claude.mjs";

const CWD = process.cwd();

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

function asyncGen(items: unknown[]) {
  return (async function* () {
    for (const item of items) yield item;
  })();
}

/** A generator that records whether `return()` was called (i.e. torn down). */
function trackedGen(items: unknown[]) {
  const state = { returned: false };
  const gen = (async function* () {
    for (const item of items) yield item;
  })();
  const originalReturn = gen.return.bind(gen);
  gen.return = ((value?: unknown) => {
    state.returned = true;
    return originalReturn(value as never);
  }) as typeof gen.return;
  return { gen, state };
}

/** Preflight always consumes the first query() call. */
function driverWith(...segments: unknown[]) {
  const query = vi.fn();
  query.mockReturnValueOnce(asyncGen([resultSuccess()]));
  for (const seg of segments) query.mockReturnValueOnce(seg);
  return { query, driver: createClaudeDriver({ importSdk: async () => ({ query }) }) };
}

describe("createInputStream", () => {
  it("delivers a message queued before the consumer asks for it", async () => {
    const s = createInputStream();
    s.push({ n: 1 });
    const it = s.iterable[Symbol.asyncIterator]();
    await expect(it.next()).resolves.toEqual({ value: { n: 1 }, done: false });
  });

  it("resolves a consumer that is already waiting when a message arrives", async () => {
    const s = createInputStream();
    const it = s.iterable[Symbol.asyncIterator]();
    const pending = it.next();
    s.push({ n: 2 });
    await expect(pending).resolves.toEqual({ value: { n: 2 }, done: false });
  });

  it("ends a waiting consumer and refuses pushes afterwards", async () => {
    const s = createInputStream();
    const it = s.iterable[Symbol.asyncIterator]();
    const pending = it.next();
    s.end();
    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    expect(() => s.push({ n: 3 })).toThrow(/closed input stream/);
  });
});

describe("segmentKey", () => {
  it("is stable regardless of schema key order", () => {
    const a = segmentKey({ mode: "readonly", outputSchema: { a: 1, b: { c: 2, d: 3 } } });
    const b = segmentKey({ mode: "readonly", outputSchema: { b: { d: 3, c: 2 }, a: 1 } });
    expect(a).toBe(b);
  });

  it("separates every query-level option that cannot change on a live query", () => {
    const base = { mode: "readonly", model: "m", effort: "low", maxTurns: 8, outputSchema: { a: 1 } };
    const key = segmentKey(base);
    expect(segmentKey({ ...base, mode: "build" })).not.toBe(key);
    expect(segmentKey({ ...base, model: "other" })).not.toBe(key);
    expect(segmentKey({ ...base, effort: "high" })).not.toBe(key);
    expect(segmentKey({ ...base, maxTurns: 12 })).not.toBe(key);
    expect(segmentKey({ ...base, outputSchema: { a: 2 } })).not.toBe(key);
  });

  it("treats absent / false / true schemas as distinct, stable tags", () => {
    expect(segmentKey({ mode: "build" })).toBe(segmentKey({ mode: "build", outputSchema: false }));
    expect(segmentKey({ mode: "build", outputSchema: true })).not.toBe(segmentKey({ mode: "build" }));
  });
});

describe("DLV-85: consecutive same-option turns share one live SDK session", () => {
  it("serves three turns from a single query() call", async () => {
    const { query, driver } = driverWith(
      asyncGen([
        resultSuccess({ result: "one" }),
        resultSuccess({ result: "two" }),
        resultSuccess({ result: "three" }),
      ]),
    );
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly", model: "m" });

    const r1 = await driver.runTurn(handle, "a", {});
    const r2 = await driver.runTurn(handle, "b", {});
    const r3 = await driver.runTurn(handle, "c", {});

    expect([r1.finalText, r2.finalText, r3.finalText]).toEqual(["one", "two", "three"]);
    // 1 preflight + 1 segment. Pre-DLV-85 this was 1 + 3.
    expect(query).toHaveBeenCalledTimes(2);
    expect(driver.sessionStats().sdkSessionsCreated).toBe(1);
    expect([r1.segment.turnIndex, r2.segment.turnIndex, r3.segment.turnIndex]).toEqual([1, 2, 3]);
    expect([r1.segment.created, r2.segment.created, r3.segment.created]).toEqual([true, false, false]);
  });

  it("does not close the generator between turns (a `for await ... break` regression)", async () => {
    const { gen, state } = trackedGen([resultSuccess({ result: "one" }), resultSuccess({ result: "two" })]);
    const { driver } = driverWith(gen);
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });

    await driver.runTurn(handle, "a", {});
    expect(state.returned).toBe(false); // still live — the whole point
    await driver.runTurn(handle, "b", {});
    expect(state.returned).toBe(false);
  });

  it("pushes each turn's prompt as a user message into the one live stream", async () => {
    const { query, driver } = driverWith(asyncGen([resultSuccess(), resultSuccess()]));
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });
    await driver.runTurn(handle, "first prompt", {});
    await driver.runTurn(handle, "second prompt", {});

    // The fake `query` never drains the prompt iterable, so both pushed
    // messages are still queued on it — which is exactly how we prove both
    // turns went into the *same* stream rather than two separate calls.
    const iterator = query.mock.calls[1][0].prompt[Symbol.asyncIterator]();
    const first = await iterator.next();
    const second = await iterator.next();
    expect(first.value).toMatchObject({ type: "user", message: { role: "user", content: "first prompt" } });
    expect(second.value).toMatchObject({ type: "user", message: { role: "user", content: "second prompt" } });
    expect(first.value.session_id).toBe(handle.ref.id);
  });
});

describe("DLV-85: a segment boundary is opened for every query-level change", () => {
  it("opens a new segment when the output schema changes", async () => {
    const { query, driver } = driverWith(asyncGen([resultSuccess({ result: "spec" })]), asyncGen([resultSuccess({ result: "plan" })]));
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });

    const r1 = await driver.runTurn(handle, "discovery", { outputSchema: { type: "object", properties: { spec: {} } } });
    const r2 = await driver.runTurn(handle, "plan", { outputSchema: { type: "object", properties: { plan: {} } } });

    expect(query).toHaveBeenCalledTimes(3); // preflight + 2 segments
    expect(r2.segment.reason).toBe("options-changed");
    expect(r2.segment.id).not.toBe(r1.segment.id);
    expect(driver.sessionStats().sdkSessionsCreated).toBe(2);
  });

  it("opens a new segment when per-phase effort changes", async () => {
    const { query, driver } = driverWith(asyncGen([resultSuccess()]), asyncGen([resultSuccess()]));
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly", effort: "low" });
    await driver.runTurn(handle, "a", { effort: "low" });
    const r2 = await driver.runTurn(handle, "b", { effort: "medium" });
    expect(query).toHaveBeenCalledTimes(3);
    expect(r2.segment.reason).toBe("options-changed");
  });

  it("keeps the readonly guarantee by segmenting on mode rather than widening tools", async () => {
    const { query, driver } = driverWith(asyncGen([resultSuccess()]), asyncGen([resultSuccess()]));
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });
    await driver.runTurn(handle, "discover", {});

    driver.resume(handle.ref, { mode: "build" });
    await driver.runTurn(handle, "build", {});

    const readonlyOptions = query.mock.calls[1][0].options;
    const buildOptions = query.mock.calls[2][0].options;
    // The readonly segment never gains write access, and the build segment is
    // a genuinely separate query() — no live session ever spans both.
    expect(readonlyOptions.tools).toEqual(["Read", "Grep", "Glob"]);
    expect(readonlyOptions.disallowedTools).toContain("Write");
    expect(readonlyOptions.permissionMode).toBe("default");
    expect(buildOptions.permissionMode).toBe("acceptEdits");
    expect(buildOptions.tools).toContain("Write");
  });
});

describe("DLV-85: failure and abort retire the segment", () => {
  it("retires the segment after an error result so the retry resumes fresh", async () => {
    const { query, driver } = driverWith(
      asyncGen([{ type: "result", subtype: "error_max_turns", is_error: true, stop_reason: "max turns", usage: {} }]),
      asyncGen([resultSuccess({ result: "recovered" })]),
    );
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });

    await expect(driver.runTurn(handle, "a", {})).rejects.toThrow(/turn failed/);
    const r2 = await driver.runTurn(handle, "a again", {});

    expect(r2.finalText).toBe("recovered");
    expect(r2.segment.created).toBe(true);
    expect(r2.segment.reason).toBe("first-turn"); // init never observed, so still a create
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("aborting a turn kills the live segment and surfaces DriverAbortedError", async () => {
    const controller = new AbortController();
    // A generator that never yields a result until aborted.
    const stalled = (async function* () {
      await new Promise((r) => setTimeout(r, 10));
      controller.abort();
      await new Promise((r) => setTimeout(r, 10));
      yield resultSuccess();
    })();
    const { driver } = driverWith(stalled);
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });

    await expect(driver.runTurn(handle, "a", { signal: controller.signal })).rejects.toBeInstanceOf(DriverAbortedError);
    expect(driver.sessionStats().openSegment).toBeNull();
  });

  it("reset() closes the open segment so a rotation never leaves a live query behind", async () => {
    const { driver } = driverWith(asyncGen([resultSuccess(), resultSuccess()]));
    const handle = await driver.startSession({ cwd: CWD, mode: "readonly" });
    await driver.runTurn(handle, "a", {});
    expect(driver.sessionStats().openSegment).not.toBeNull();
    driver.reset();
    expect(driver.sessionStats().openSegment).toBeNull();
  });
});
