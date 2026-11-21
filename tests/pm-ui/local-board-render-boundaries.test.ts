import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHookRuntime } from "./local-board-hook-runtime";
import { boardRun, epoch, row } from "./local-board-fixtures";
import { buildTimeline, sceneAt } from "../../scripts/pm/app/localRunScene";
import {
  attentionId,
  localRunAttention,
} from "../../scripts/pm/app/localRunAttention";

const hook = vi.hoisted(() => ({
  current: null as ReturnType<typeof createHookRuntime> | null,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: <T>(value: T | (() => T)) => hook.current!.useState(value),
  useRef: <T>(value: T) => hook.current!.useRef(value),
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) =>
    hook.current!.useMemo(factory, deps),
  useCallback: <T>(callback: T, deps: readonly unknown[]) =>
    hook.current!.useCallback(callback, deps),
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) =>
    hook.current!.useEffect(effect, deps),
}));
import {
  useAttentionProjection,
  useLocalAttention,
  useRunHealth,
} from "../../scripts/pm/app/useLocalAttention";
import { boardClock } from "../../scripts/pm/app/stage/clockStore";

const storage = new Map<string, string>();
const unsubscribers: (() => void)[] = [];
beforeEach(() => {
  hook.current = createHookRuntime();
  vi.useFakeTimers();
  vi.setSystemTime(epoch);
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => {
  hook.current?.unmount();
  unsubscribers.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("SQL acknowledgements can be undone locally without changing server review or acceptance", () => {
  vi.setSystemTime(epoch + 2000);
  const run = boardRun({
    activity: [
      row(0, "status", "Native session started"),
      row(1, "edit", "migrations/a.sql"),
    ],
  });
  const runtime = hook.current!;
  const first = runtime.render(() => useLocalAttention(run, "live"));
  const id = first.attention.find((item) => item.kind === "sql")!.id;
  first.acknowledge(id);
  const done = runtime.render(() => useLocalAttention(run, "live"));
  expect(done.attention.find((item) => item.id === id)?.state).toBe("done");
  done.acknowledge(id, false);
  const open = runtime.render(() => useLocalAttention(run, "live"));
  expect(open.attention.find((item) => item.id === id)?.state).toBe("open");
  expect(
    JSON.parse(storage.get("pm-local-attention:" + run.run_id)!),
  ).not.toContain(id);
  expect(run.canShip).toBe(false);
  expect(run.reviewed_head).toBeUndefined();
  expect(run.handover).toBeNull();
});

describe("R123 clock subscription boundary", () => {
  it("publishes only to subscribers and unsubscribe/cleanup detaches the leaf", () => {
    const first = vi.fn(),
      second = vi.fn();
    const stopFirst = boardClock.subscribe(first),
      stopSecond = boardClock.subscribe(second);
    unsubscribers.push(stopFirst, stopSecond);
    boardClock.tick(epoch);
    expect(boardClock.get()).toBe(epoch);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopFirst();
    boardClock.tick(epoch + 1000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    stopSecond();
    boardClock.tick(epoch + 2000);
    expect(second).toHaveBeenCalledTimes(2);
  });
});

describe("R123 hook-unit render boundaries", () => {
  it("health ticks publish only category transitions and stop on unmount", () => {
    const run = boardRun(),
      runtime = hook.current!;
    expect(runtime.render(() => useRunHealth(run)).state).toBe("live");
    vi.advanceTimersByTime(19_000);
    expect(runtime.updates).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(runtime.updates).toBe(1);
    expect(runtime.render(() => useRunHealth(run)).state).toBe("thinking");
    vi.advanceTimersByTime(69_000);
    expect(runtime.updates).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(runtime.updates).toBe(2);
    expect(runtime.render(() => useRunHealth(run)).state).toBe("quiet");
    vi.advanceTimersByTime(150_000);
    expect(runtime.updates).toBe(3);
    expect(runtime.render(() => useRunHealth(run)).state).toBe("stale");
    runtime.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(runtime.updates).toBe(0);
  });
  it("new signal replaces the prior closure and resets health without leaking an interval", () => {
    const runtime = hook.current!,
      run = boardRun();
    runtime.render(() => useRunHealth(run));
    vi.advanceTimersByTime(240_000);
    expect(runtime.render(() => useRunHealth(run)).state).toBe("stale");
    const next = {
      ...run,
      activity: [...run.activity, row(240, "message", "Recorded update")],
    };
    expect(runtime.render(() => useRunHealth(next)).state).toBe("live");
    expect(vi.getTimerCount()).toBe(1);
    const updates = runtime.updates;
    vi.advanceTimersByTime(19_000);
    expect(runtime.updates).toBe(updates);
    vi.advanceTimersByTime(1000);
    expect(runtime.updates).toBe(updates + 1);
  });
  it("real request errors update on props; closed intentional polling does not become link down", () => {
    const runtime = hook.current!,
      run = boardRun({ phase: "shipped" });
    const poll = { dataUpdatedAt: epoch };
    runtime.render(() => useRunHealth(run, poll));
    vi.advanceTimersByTime(30_000);
    expect(runtime.updates).toBe(0);
    expect(
      runtime.render(() => useRunHealth(run, { ...poll, isError: true })).state,
    ).toBe("link-down");
    expect(vi.getTimerCount()).toBe(1);
  });
  it("stable facts retain the rail identity across second ticks; acknowledgements publish and persist", () => {
    const runtime = hook.current!,
      run = boardRun({
        work: { id: "R123", title: "Fixture", brief: "Recorded brief" },
      });
    const first = runtime.render(() => useLocalAttention(run, "live"));
    vi.advanceTimersByTime(10_000);
    boardClock.tick();
    const unchanged = runtime.render(() => useLocalAttention(run, "live"));
    expect(unchanged.attention).toBe(first.attention);
    expect(runtime.updates).toBe(0);
    unchanged.acknowledge(first.attention[0].id);
    const done = runtime.render(() => useLocalAttention(run, "live"));
    expect(done.attention).not.toBe(first.attention);
    expect(done.attention[0].state).toBe("done");
    expect(
      JSON.parse(storage.get("pm-local-attention:" + run.run_id)!),
    ).toEqual([first.attention[0].id]);
  });
  it("state category change invalidates attention once and exposes stale acts", () => {
    const runtime = hook.current!,
      run = boardRun();
    const first = runtime.render(() => useLocalAttention(run, "live"));
    vi.setSystemTime(epoch + 240_000);
    const stale = runtime.render(() => useLocalAttention(run, "stale"));
    expect(stale.attention).not.toBe(first.attention);
    expect(
      stale.attention.some(
        (item) => item.kind === "silent" && item.level === "act",
      ),
    ).toBe(true);
    expect(
      runtime.render(() => useLocalAttention(run, "stale")).attention,
    ).toBe(stale.attention);
  });
  it("new keyed mounts read only their run's stored ids and recover from malformed storage", () => {
    const runtime = hook.current!,
      run = boardRun({
        work: { id: "R123", title: "Fixture", brief: "Brief" },
      });
    const id = attentionId(run.run_id, "plan", "brief");
    storage.set(
      "pm-local-attention:" + run.run_id,
      JSON.stringify([id, "other-run:plan:brief", 42]),
    );
    const first = runtime.render(() => useLocalAttention(run, "live"));
    expect([...first.seen]).toEqual([id]);
    expect(first.attention[0].state).toBe("done");
    runtime.unmount();
    hook.current = createHookRuntime();
    const next = { ...run, run_id: "local-other-fixture" };
    storage.set("pm-local-attention:" + next.run_id, "invalid-json");
    expect(
      hook.current.render(() => useLocalAttention(next, "live")).attention[0]
        .state,
    ).toBe("open");
  });
  it("unavailable storage keeps acknowledgement as an optional in-memory preference", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Unavailable");
      },
      setItem: () => {
        throw new Error("Unavailable");
      },
    });
    const runtime = hook.current!,
      run = boardRun({
        work: { id: "R123", title: "Fixture", brief: "Brief" },
      });
    const first = runtime.render(() => useLocalAttention(run, "live"));
    expect(() => first.acknowledge(first.attention[0].id)).not.toThrow();
    expect(
      runtime.render(() => useLocalAttention(run, "live")).attention[0].state,
    ).toBe("done");
  });
  it("replay gap clocks preserve rail identity; new rows/seen/backend facts invalidate it", () => {
    const runtime = hook.current!,
      run = boardRun({
        activity: [
          row(0, "status", "Native session started"),
          row(1, "edit", "migrations/a.sql"),
          row(325, "message", "Recorded next note"),
        ],
      });
    const timeline = buildTimeline(run),
      seen = new Set<string>(),
      real = localRunAttention(run, seen, epoch + 400_000);
    const project = (
      at: number,
      state = "quiet",
      input = run,
      acknowledged = seen,
    ) =>
      runtime.render(() =>
        useAttentionProjection(
          input,
          sceneAt(timeline, at),
          at,
          state,
          acknowledged,
          real,
        ),
      );
    const first = project(epoch + 100_000);
    expect(project(epoch + 101_000)).toBe(first);
    expect(project(epoch + 325_000)).not.toBe(first);
    const stale = project(epoch + 241_000, "stale");
    expect(stale.some((item) => item.kind === "silent")).toBe(true);
    const ack = new Set([attentionId(run.run_id, "sql", "migrations/a.sql")]);
    expect(
      project(epoch + 241_000, "stale", run, ack).find(
        (item) => item.kind === "sql",
      )?.state,
    ).toBe("done");
    expect(project(epoch + 241_000, "stale", { ...run }, ack)).not.toBe(stale);
    expect(
      runtime.render(() =>
        useAttentionProjection(
          run,
          sceneAt(timeline, epoch),
          null,
          "live",
          seen,
          real,
        ),
      ),
    ).toBe(real);
  });
});
