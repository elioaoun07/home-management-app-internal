import { describe, expect, it, vi } from "vitest";
import {
  DriverAbortedError,
  DriverError,
  createDriver,
  listRegisteredDrivers,
  registerDriver,
  unregisterDriver,
} from "../../scripts/delivery/drivers/driver.mjs";
// Importing fake.mjs self-registers "fake" into the shared driver registry.
import "../../scripts/delivery/drivers/fake.mjs";
import "../../scripts/delivery/drivers/codex.mjs";
import "../../scripts/delivery/drivers/claude.mjs";

describe("driver registry", () => {
  it("registers fake and both real providers without loading either SDK", () => {
    expect(listRegisteredDrivers()).toEqual(expect.arrayContaining(["fake", "codex", "claude"]));
  });

  it("throws a clear DriverError for an unregistered kind", () => {
    expect(() => createDriver("missing-provider")).toThrow(DriverError);
    expect(() => createDriver("missing-provider")).toThrow(/no driver registered/);
  });

  it("registerDriver requires a kind and a factory function", () => {
    expect(() => registerDriver("", () => ({}))).toThrow(DriverError);
    expect(() => registerDriver("x", undefined)).toThrow(DriverError);
  });

  it("register/unregister round-trips for a temp kind without disturbing fake", () => {
    const factory = vi.fn().mockReturnValue({ kind: "temp" });
    registerDriver("temp-test-kind", factory);
    expect(listRegisteredDrivers()).toContain("temp-test-kind");
    createDriver("temp-test-kind");
    expect(factory).toHaveBeenCalledTimes(1);
    unregisterDriver("temp-test-kind");
    expect(listRegisteredDrivers()).not.toContain("temp-test-kind");
    expect(listRegisteredDrivers()).toContain("fake");
  });
});

describe("fake driver: session lifecycle", () => {
  it("startSession returns a ref and rejects starting twice", () => {
    const driver = createDriver("fake", { script: { turns: [] } });
    const handle = driver.startSession({ cwd: "/repo", mode: "build" });
    expect(handle.ref.id).toBeDefined();
    expect(handle.cwd).toBe("/repo");
    expect(() => driver.startSession({ cwd: "/repo", mode: "build" })).toThrow(DriverError);
  });

  it("rejects an unknown mode", () => {
    const driver = createDriver("fake", { script: { turns: [] } });
    expect(() => driver.startSession({ cwd: "/repo", mode: "bogus" })).toThrow(DriverError);
  });

  it("resume requires a ref with an id", () => {
    const driver = createDriver("fake", { script: { turns: [] } });
    expect(() => driver.resume(null)).toThrow(DriverError);
    expect(() => driver.resume({})).toThrow(DriverError);
    const handle = driver.resume({ id: "prior-id", cwd: "/repo", mode: "build" });
    expect(handle.ref.id).toBe("prior-id");
  });

  it("runTurn before start/resume throws", () => {
    const driver = createDriver("fake", { script: { turns: [] } });
    expect(() => driver.runTurn({}, "do the thing")).toThrow(DriverError);
  });

  it("runTurn rejects an empty prompt", () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "ok" }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    expect(() => driver.runTurn({}, "")).toThrow(DriverError);
    expect(() => driver.runTurn({}, "   ")).toThrow(DriverError);
  });
});

describe("fake driver: scripted turn sequencing", () => {
  it("consumes turns in order and returns their finalText/usage", () => {
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: "spec drafted", usage: { input: 10, cachedInput: 0, output: 5, costUsd: null } },
          { finalText: "plan drafted" },
        ],
      },
    });
    driver.startSession({ cwd: "/repo", mode: "build" });
    const r1 = driver.runTurn({}, "write the spec");
    expect(r1.finalText).toBe("spec drafted");
    expect(r1.usage.input).toBe(10);

    const r2 = driver.runTurn({}, "write the plan");
    expect(r2.finalText).toBe("plan drafted");
    expect(r2.usage).toEqual({ input: 0, cachedInput: 0, output: 0, costUsd: null });
  });

  it("throws once the script is exhausted", () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "only turn" }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    driver.runTurn({}, "go");
    expect(() => driver.runTurn({}, "go again")).toThrow(/script exhausted/);
  });

  it("invokes onEvent for every scripted event, in order", () => {
    const events = [{ type: "agent.message", data: { n: 1 } }, { type: "agent.command", data: { n: 2 } }];
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done", events }] } });
    driver.startSession({ cwd: "/repo", mode: "readonly" });
    const seen: unknown[] = [];
    driver.runTurn({}, "go", { onEvent: (e: unknown) => seen.push(e) });
    expect(seen).toEqual(events);
  });

  it("propagates a scripted throw as a DriverError", () => {
    const driver = createDriver("fake", { script: { turns: [{ throws: "simulated agent failure" }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    expect(() => driver.runTurn({}, "go")).toThrow(/simulated agent failure/);
  });

  it("validates finalText as JSON when an outputSchema is given", () => {
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: "not json" }, { finalText: '{"ok":true}' }] },
    });
    driver.startSession({ cwd: "/repo", mode: "build" });
    expect(() => driver.runTurn({}, "go", { outputSchema: {} })).toThrow(/valid JSON/);
    const r = driver.runTurn({}, "go again", { outputSchema: {} });
    expect(r.finalText).toBe('{"ok":true}');
  });

  it("keeps malformed structured output isolated to the failing scripted turn", () => {
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: "{broken" }, { finalText: '{"valid":true}' }] },
    });
    driver.startSession({ cwd: "/repo", mode: "build" });

    expect(() => driver.runTurn({}, "draft", { outputSchema: { type: "object" } })).toThrow(/valid JSON/);
    expect(driver.runTurn({}, "retry", { outputSchema: { type: "object" } }).finalText).toBe('{"valid":true}');
  });
});

describe("fake driver: seam v2 (manifest, onRaw, turnMeta, per-turn overrides)", () => {
  it("exposes a pure-data manifest", () => {
    const driver = createDriver("fake", { script: { turns: [] } });
    const manifest = driver.manifest();
    expect(manifest.provider).toBe("fake");
    expect(manifest.supportsPerTurnModel).toBe(true);
    expect(manifest.supportsPerTurnEffort).toBe(true);
    expect(manifest.supportsAbort).toBe(true);
    expect(manifest.usage).toEqual({ cacheCreation: true, reasoning: true, costReported: true });
  });

  it("invokes onRaw for every scripted raw record, in order", () => {
    const rawRecords = [
      { kind: "prompt", text: "assembled prompt" },
      { kind: "assistant.text", text: "hi" },
      { kind: "tool.use", tool: "Read" },
    ];
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done", rawRecords }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    const seen: unknown[] = [];
    driver.runTurn({}, "go", { onRaw: (r: unknown) => seen.push(r) });
    expect(seen).toEqual(rawRecords);
  });

  it("does not require onRaw — rawRecords are simply skipped when absent", () => {
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: "done", rawRecords: [{ kind: "prompt", text: "x" }] }] },
    });
    driver.startSession({ cwd: "/repo", mode: "build" });
    expect(() => driver.runTurn({}, "go")).not.toThrow();
  });

  it("returns a default turnMeta with modelUsed/numTurns/durationMs/compactBoundaries", () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done" }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    const result = driver.runTurn({}, "go", { model: "fake-model-x" });
    expect(result.turnMeta).toEqual({ modelUsed: "fake-model-x", numTurns: 1, durationMs: 0, compactBoundaries: [] });
  });

  it("honors a scripted turnMeta override", () => {
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: "done", turnMeta: { modelUsed: "override", numTurns: 3, durationMs: 999, compactBoundaries: [{ trigger: "auto" }] } }] },
    });
    driver.startSession({ cwd: "/repo", mode: "build" });
    expect(driver.runTurn({}, "go").turnMeta.numTurns).toBe(3);
  });

  it("tracks per-turn model/effort overrides onto the current ref (resume-with-overrides)", () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "a" }, { finalText: "b" }] } });
    const handle = driver.startSession({ cwd: "/repo", mode: "build", model: "model-1" });
    expect(handle.ref.model).toBe("model-1");
    driver.runTurn({}, "go", { model: "model-2", effort: "high" });
    expect(handle.ref.model).toBe("model-2");
    expect(handle.ref.effort).toBe("high");
  });

  it("passes v2-shaped usage straight through unchanged", () => {
    const usageV2 = { input: 10, cachedRead: 2, cacheCreation: 1, output: 5, reasoningOutput: 3, costUsd: null };
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done", usage: usageV2 }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    expect(driver.runTurn({}, "go").usage).toEqual(usageV2);
  });
});

describe("fake driver: mid-turn abort (DW-10)", () => {
  it("a synchronous scripted turn (no delayMs) is returned as a plain object, ignoring signal entirely", () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done" }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    const controller = new AbortController();
    controller.abort(); // already aborted — must not affect a turn that never opted into delayMs
    const result = driver.runTurn({}, "go", { signal: controller.signal });
    expect(result).not.toBeInstanceOf(Promise);
    expect((result as { finalText: string }).finalText).toBe("done");
  });

  it("a delayed turn resolves normally when never aborted", async () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done", delayMs: 5 }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    const result = await driver.runTurn({}, "go", {});
    expect(result.finalText).toBe("done");
  });

  it("rejects with DriverAbortedError when the signal fires before the delay elapses", async () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done", delayMs: 200 }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    const controller = new AbortController();
    const pending = driver.runTurn({}, "go", { signal: controller.signal });
    setTimeout(() => controller.abort(), 5);
    await expect(pending).rejects.toThrow(DriverAbortedError);
  });

  it("rejects immediately with DriverAbortedError when the signal is already aborted", async () => {
    const driver = createDriver("fake", { script: { turns: [{ finalText: "done", delayMs: 200 }] } });
    driver.startSession({ cwd: "/repo", mode: "build" });
    const controller = new AbortController();
    controller.abort();
    await expect(driver.runTurn({}, "go", { signal: controller.signal })).rejects.toThrow(DriverAbortedError);
  });
});
