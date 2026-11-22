// DLV-166. Replay-only: a fake child process stands in for `pnpm dev`.
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutEnv, choosePort, createPreviews, portFree } from "../../scripts/delivery-v2/local-preview.mjs";
import { routeLocal } from "../../scripts/delivery-v2/local-routes.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));
function checkout(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "era-preview-"));
  roots.push(root);
  for (const [name, value] of Object.entries(files)) writeFileSync(join(root, name), value);
  return root;
}
type Fake = EventEmitter & { pid: number; stdout: PassThrough; stderr: PassThrough };
function fakeSpawn() {
  const calls: { bin: string; args: string[]; options: { cwd: string; env: Record<string, string> }; child: Fake }[] = [];
  let pid = 4000;
  const spawn = vi.fn((bin: string, args: string[], options: { cwd: string; env: Record<string, string> }) => {
    const child = Object.assign(new EventEmitter(), { pid: ++pid, stdout: new PassThrough(), stderr: new PassThrough() }) as Fake;
    calls.push({ bin, args, options, child });
    return child;
  });
  return { spawn, calls };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("DLV-166 checkout env", () => {
  it("loads next dev's files in precedence order without touching process.env", () => {
    const root = checkout({ ".env": "A=env\nB=env\n# comment\nQUOTED=\"x=y\"\n", ".env.local": "A=local\n" });
    const before = { ...process.env };
    expect(checkoutEnv(root)).toEqual({ values: { A: "local", B: "env", QUOTED: "x=y" }, loaded: [".env.local", ".env"] });
    expect(process.env).toEqual(before);
  });
  it("reports no files for a checkout without env", () => {
    expect(checkoutEnv(checkout({}))).toEqual({ values: {}, loaded: [] });
  });
});

describe("DLV-166 port choice", () => {
  it("prefers 3000, then the first free port from 3100", async () => {
    expect(await choosePort(async port => port === 3000)).toBe(3000);
    expect(await choosePort(async port => port > 3101)).toBe(3102);
    await expect(choosePort(async () => false)).rejects.toThrow("preview-no-free-port");
  });
  it("sees a taken port as busy", async () => {
    const server = createServer();
    await new Promise<void>(resolve => server.listen({ port: 0, host: "127.0.0.1" }, resolve));
    const { port } = server.address() as AddressInfo;
    expect(await portFree(port)).toBe(false);
    await new Promise(resolve => server.close(resolve));
    expect(await portFree(port)).toBe(true);
  });
});

describe("DLV-166 previews", () => {
  const setup = (files: Record<string, string> = { ".env": "NEXT_PUBLIC_SUPABASE_URL=https://fixture.invalid\nSECRET=s\n" }) => {
    const root = checkout(files);
    const fake = fakeSpawn(), kill = vi.fn();
    const previews = createPreviews({ root, spawn: fake.spawn as never, choose: async () => 3100, command: () => ["node", "pnpm.cjs"],
      kill, env: { PATH: "/bin", NODE_ENV: "production", PORT: "1", npm_lifecycle_event: "pm" } });
    return { root, previews, kill, ...fake };
  };

  it("runs pnpm dev in the workspace with the checkout's values in the environment only", async () => {
    const f = setup();
    const view = await f.previews.start("run-a", { workspace: "/work/BUD-95" });
    expect(view).toMatchObject({ state: "starting", url: "http://localhost:3100", port: 3100 });
    const [call] = f.calls;
    expect(call.bin).toBe("node");
    expect(call.args).toEqual(["pnpm.cjs", "dev", "--port", "3100"]);
    expect(call.options.cwd).toBe("/work/BUD-95");
    expect(call.options.env).toMatchObject({ PATH: "/bin", NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", SECRET: "s" });
    expect(call.options.env).not.toHaveProperty("NODE_ENV");
    expect(call.options.env).not.toHaveProperty("PORT");
    expect(call.options.env).not.toHaveProperty("npm_lifecycle_event");
  });

  it("turns ready on Next's Ready line and strips colour codes", async () => {
    const f = setup();
    await f.previews.start("run-a", { workspace: "/w" });
    f.calls[0].child.stdout.write("\u001b[32m✓\u001b[39m Starting...\n");
    await tick();
    expect(f.previews.view("run-a")?.state).toBe("starting");
    f.calls[0].child.stdout.write(" ✓ Ready in 1.2s\n");
    await tick();
    expect(f.previews.view("run-a")).toMatchObject({ state: "ready" });
    expect(f.previews.view("run-a")?.tail).not.toContain("\u001b");
  });

  it("reuses a live preview, keeps one at a time and stops the tree", async () => {
    const f = setup();
    await Promise.all([f.previews.start("run-a", { workspace: "/a" }), f.previews.start("run-a", { workspace: "/a" })]);
    expect(f.calls).toHaveLength(1);
    await f.previews.start("run-b", { workspace: "/b" });
    expect(f.kill).toHaveBeenCalledWith(f.calls[0].child.pid);
    expect(f.previews.view("run-a")?.state).toBe("stopped");
    f.calls[0].child.emit("close", 1);
    expect(f.previews.view("run-a")?.state).toBe("stopped");
    expect(f.previews.stop("run-b")?.state).toBe("stopped");
    expect(f.kill).toHaveBeenLastCalledWith(f.calls[1].child.pid);
  });

  it("reports an unexpected exit with its output", async () => {
    const f = setup();
    await f.previews.start("run-a", { workspace: "/a" });
    f.calls[0].child.stderr.write("Error: boom\n");
    await tick();
    f.calls[0].child.emit("close", 1);
    expect(f.previews.view("run-a")).toMatchObject({ state: "failed", exit: 1, tail: expect.stringContaining("boom") });
  });

  it("refuses without a checkout env and starts nothing", async () => {
    const f = setup({});
    await expect(f.previews.start("run-a", { workspace: "/a" })).rejects.toThrow("preview-env-missing");
    expect(f.calls).toHaveLength(0);
  });
});

describe("DLV-166 route", () => {
  it("dispatches preview, stop-preview and merge (DLV-167), desktop-only", async () => {
    const local = { preview: vi.fn(async () => ({ preview: { state: "starting" } })), stopPreview: vi.fn(async () => ({ preview: { state: "stopped" } })), merge: vi.fn(async () => ({ phase: "shipped" })) };
    const run_id = "local-38c4d389-54ea-4446-a0db-ab3b9d3795c1";
    const post = (action: string, loopbackPeer = true) => routeLocal({ method: "POST", path: "/api/delivery/v2/local", body: { action, run_id }, loopbackPeer }, { kind: "browser" }, { local });
    expect(await post("preview")).toMatchObject({ status: 200, json: { ok: true, preview: { state: "starting" } } });
    expect(await post("stop-preview")).toMatchObject({ status: 200, json: { ok: true, preview: { state: "stopped" } } });
    expect(local.preview).toHaveBeenCalledWith(run_id);
    expect(local.stopPreview).toHaveBeenCalledWith(run_id);
    expect(await post("merge")).toMatchObject({ status: 200, json: { ok: true, phase: "shipped" } });
    expect(local.merge).toHaveBeenCalledWith(run_id);
    expect(await post("preview", false)).toMatchObject({ status: 403 });
  });
});
