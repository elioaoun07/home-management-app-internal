import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDesktopLifecycle, deliveryRestartBlocker } from "../../scripts/pm/desktop-lifecycle.mjs";
import { createDeliveryV2Context } from "../../scripts/delivery-v2/service.mjs";

const instance = "aa".repeat(16);
const first = "bb".repeat(16);
const second = "cc".repeat(16);
const directories: string[] = [];
function fixture(blocker: () => string | null = () => null) {
  const dir = mkdtempSync(join(tmpdir(), "pm-desktop-"));
  directories.push(dir);
  const shutdown = vi.fn();
  const controller = createDesktopLifecycle({ dir, instance, port: 4317, blocker, shutdown, intervalMs: 0 });
  const request = join(dir, "restart-" + instance + ".json");
  const result = (id: string) => JSON.parse(readFileSync(join(dir, "result-" + id + ".json"), "utf8"));
  return { dir, shutdown, controller, request, result };
}
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("desktop restart mailbox", () => {
  it("acknowledges only this instance, after a successful idle check", () => {
    const { dir, shutdown, controller, request, result } = fixture();
    const ready = join(dir, "ready-" + instance + ".json");
    expect(JSON.parse(readFileSync(ready, "utf8"))).toEqual({ pid: process.pid, instance, port: 4317 });
    writeFileSync(join(dir, "restart-" + second + ".json"), JSON.stringify({ id: first }));
    controller.poll();
    expect(shutdown).not.toHaveBeenCalled();
    writeFileSync(request, "\uFEFF" + JSON.stringify({ id: first }));
    controller.poll();
    expect(result(first).status).toBe("restarting");
    expect(shutdown).toHaveBeenCalledOnce();
    expect(existsSync(request)).toBe(false);
    controller.stop();
    expect(existsSync(ready)).toBe(false);
  });

  it("requires a new request after a refusal and recovers from malformed input", () => {
    const blocker = vi.fn<() => string | null>().mockImplementationOnce(() => { throw new Error("busy"); }).mockReturnValue(null);
    const { request, controller, shutdown, result } = fixture(blocker);
    for (const invalid of ["null", "{", JSON.stringify({ id: "../escape" })]) {
      writeFileSync(request, invalid);
      controller.poll();
      expect(existsSync(request)).toBe(false);
    }
    writeFileSync(request, JSON.stringify({ id: first }));
    controller.poll();
    expect(result(first).status).toBe("refused");
    writeFileSync(request, JSON.stringify({ id: first }));
    controller.poll();
    expect(shutdown).not.toHaveBeenCalled();
    expect(blocker).toHaveBeenCalledOnce();
    writeFileSync(request, JSON.stringify({ id: second }));
    controller.poll();
    expect(shutdown).toHaveBeenCalledOnce();
    controller.stop();
  });
});

describe("desktop restart admission", () => {
  const context = () => ({
    activeV1Writers: () => [] as string[],
    local: { isWorking: () => false },
    hasStore: () => true,
    passiveStore: () => ({
      listRuns: () => [] as { run_id: string }[],
      listAllJobs: () => [] as { job_id: string; run_id: string; status: string }[],
      listUsageReadings: () => [],
      listSettledUnprocessedJobs: () => [] as Record<string, unknown>[],
      listSubagentActivity: () => [],
      listActiveApplications: () => [] as Record<string, unknown>[],
      readOnlySnapshotCurrent: () => true,
      close: () => {},
    }),
  });
  it("protects legacy runs and in-memory Local work even before a store exists", () => {
    const ctx = context();
    ctx.hasStore = () => false;
    expect(deliveryRestartBlocker(ctx)).toBe(null);
    ctx.activeV1Writers = () => ["legacy-1"];
    expect(deliveryRestartBlocker(ctx)).toContain("legacy-1");
    ctx.activeV1Writers = () => [];
    ctx.local.isWorking = () => true;
    expect(deliveryRestartBlocker(ctx)).toContain("Local");
  });
  it("checks an actual empty supervisor both while open and after a clean close", () => {
    const root = mkdtempSync(join(tmpdir(), "pm-desktop-store-"));
    directories.push(root);
    const contextOptions = { ROOT: root, pmRel: "pm" };
    const ctx = createDeliveryV2Context(contextOptions);
    expect(deliveryRestartBlocker(ctx)).toBeNull();
    expect(ctx.hasStore()).toBe(false);
    const store = ctx.store;
    try {
      expect(deliveryRestartBlocker(ctx)).toBeNull();
      expect(() => deliveryRestartBlocker(createDeliveryV2Context(contextOptions))).toThrow(/WAL/);
    } finally {
      store.close();
    }
    const fresh = createDeliveryV2Context(contextOptions);
    expect(deliveryRestartBlocker(fresh)).toBeNull();
    expect(fresh.passiveStore()).toBeNull();
  });
  it("protects unconfirmed jobs, applications and a changing supervisor snapshot", () => {
    const ctx = context();
    const view = ctx.passiveStore();
    ctx.passiveStore = () => view;
    expect(deliveryRestartBlocker(ctx)).toBe(null);
    view.listAllJobs = () => [{ job_id: "j1", run_id: "r1", status: "unknown" }];
    expect(deliveryRestartBlocker(ctx)).toContain("unconfirmed");
    view.listAllJobs = () => [];
    view.listActiveApplications = () => [{ state: "writing" }];
    expect(deliveryRestartBlocker(ctx)).toContain("active");
    view.listActiveApplications = () => [];
    view.listSettledUnprocessedJobs = () => [{ status: "finished" }];
    expect(deliveryRestartBlocker(ctx)).toContain("active");
    view.listSettledUnprocessedJobs = () => [];
    view.readOnlySnapshotCurrent = () => false;
    expect(deliveryRestartBlocker(ctx)).toContain("changed");
  });
});
