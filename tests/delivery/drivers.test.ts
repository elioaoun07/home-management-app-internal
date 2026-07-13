import { describe, expect, it, vi } from "vitest";
import {
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
