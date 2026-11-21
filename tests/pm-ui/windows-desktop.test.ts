import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const lifecycle = pathToFileURL(resolve("scripts/pm/desktop-lifecycle.mjs")).href;
const pmServer = `
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createDesktopLifecycle } from ${JSON.stringify(lifecycle)};

const port = Number(process.env.PM_PORT);
const instance = process.env.PM_DESKTOP_INSTANCE;
const relay = '.delivery/pm-relay/bridge.lock';
const server = createServer((req, res) => res.end('<link href="/assets/pm-icon.svg">'));
server.listen(port, '127.0.0.1', () => {
  mkdirSync('.delivery/pm-relay', {recursive: true});
  writeFileSync(relay, JSON.stringify({pid: process.pid}));
  appendFileSync('starts.jsonl', JSON.stringify({cwd: process.cwd(), args: process.argv.slice(2), instance}) + '\\n');
  process.stdout.write('Pairing code: TEST-PAIRING-SECRET\\n');
  const lifecycle = createDesktopLifecycle({
    dir: '.pm/desktop', instance, port, intervalMs: 25,
    blocker: () => existsSync('busy') ? 'Fixture delivery is busy.' : null,
    shutdown: () => close()
  });
  const timer = setInterval(() => { if (existsSync('end-fixture')) close(); }, 50);
  function close() {
    clearInterval(timer);
    lifecycle.stop();
    rmSync(relay, {force: true});
    server.close();
    server.closeAllConnections();
  }
});
`;

async function listen(server: Server) {
  await new Promise<void>((ready, reject) => server.once("error", reject).listen(0, "127.0.0.1", ready));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a loopback TCP port");
  return address.port;
}

function close(server: Server) {
  return new Promise<void>((done, reject) => {
    server.close(error => error ? reject(error) : done());
    server.closeAllConnections();
  });
}

function fixture(port: number) {
  const root = mkdtempSync(join(tmpdir(), "ERA PM desktop test "));
  const directory = join(root, "scripts", "pm", "windows");
  const script = join(directory, "desktop.mjs");
  const desktop = join(root, ".pm", "desktop");
  mkdirSync(directory, { recursive: true });
  copyFileSync(resolve("scripts/pm/windows/desktop.mjs"), script);
  writeFileSync(join(root, "package.json"), JSON.stringify({
    private: true, scripts: { pm: "node server.mjs", "pm:build-app": "node build.mjs" },
  }));
  writeFileSync(join(root, "server.mjs"), pmServer);
  writeFileSync(join(root, "build.mjs"), `
    import { appendFileSync, existsSync } from 'node:fs';
    appendFileSync('builds.txt', process.cwd() + '\\n');
    if (existsSync('broken-build')) process.exitCode = 1;
  `);
  // Only the executable search path and local OS variables reach the test runner.
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PM_PORT: String(port), COREPACK_ENABLE_NETWORK: "0", npm_config_offline: "true" };
  for (const key of ["PATH", "PATHEXT", "SystemRoot", "ComSpec", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return {
    root, desktop,
    starts(): { cwd: string; args: string[]; instance: string }[] {
      return readFileSync(join(root, "starts.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
    },
    command(action: string) {
      return new Promise<{ code: number; ok: boolean; state: string; message: string; url?: string }>((done, reject) => {
        // A different caller cwd exercises the switch into the checkout.
        execFile(process.execPath, [script, action], { cwd: tmpdir(), env, timeout: 70_000 }, (error, out, err) => {
          try {
            const code = error?.code ?? 0;
            if (typeof code !== "number" || !out.trim()) throw error || Error(err);
            done({ ...JSON.parse(out), code });
          } catch (problem) { reject(problem); }
        });
      });
    },
    async dispose() {
      // This file only the test server watches asks every remaining generation to exit.
      // Let its wrapper release the checkout before removing a generated fixture.
      const state = join(desktop, "instance.json");
      const hostPid = existsSync(state) ? JSON.parse(readFileSync(state, "utf8")).hostPid : null;
      writeFileSync(join(root, "end-fixture"), "");
      await expect.poll(() => !existsSync(state) || JSON.parse(readFileSync(state, "utf8")).failed, { timeout: 12_000 }).toBeTruthy();
      if (process.platform === "win32" && Number.isInteger(hostPid)) {
        // The exit receipt is written before Windows releases the host's cwd.
        await expect.poll(() => {
          try { process.kill(hostPid, 0); return false; }
          catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
        }, { timeout: 8_000 }).toBe(true);
      }
      // A pnpm child or filesystem scanner can retain a Windows directory
      // handle after the launcher exits. Retry cleanup without blocking Node.
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    },
  };
}

describe("Windows PM desktop controller", () => {
  it("starts one checkout, checks active work, and only restarts after a successful build", async () => {
    const probe = createServer();
    const port = await listen(probe);
    await close(probe);
    const f = fixture(port);
    try {
      expect(await f.command("status")).toMatchObject({ state: "stopped", code: 0 });
      expect(await f.command("start")).toMatchObject({ state: "running", code: 0, url: `http://127.0.0.1:${port}/` });
      expect(await f.command("open")).toMatchObject({ state: "running", code: 0 });
      expect(await f.command("start")).toMatchObject({ state: "running", code: 0 });
      const [first] = f.starts();
      expect(f.starts()).toHaveLength(1);
      expect(first.cwd).toBe(f.root);
      expect(first.args).toEqual(["--bridge", "--no-open", "--host=127.0.0.1", "--port=" + port]);
      expect(first.instance).toMatch(/^[a-f0-9]{32}$/);
      expect((await f.command("status")).message).toContain("Phone bridge is running");

      writeFileSync(join(f.root, "busy"), "");
      expect(await f.command("restart")).toMatchObject({ state: "refused", code: 1, message: "Fixture delivery is busy." });
      expect(f.starts()).toHaveLength(1);
      rmSync(join(f.root, "busy"));
      writeFileSync(join(f.root, "broken-build"), "");
      expect(await f.command("rebuild")).toMatchObject({ state: "build-failed", code: 1 });
      expect(await f.command("status")).toMatchObject({ state: "running", code: 0 });
      expect(f.starts()).toHaveLength(1);
      rmSync(join(f.root, "broken-build"));

      expect(await f.command("restart")).toMatchObject({ state: "running", code: 0 });
      expect(await f.command("rebuild")).toMatchObject({ state: "running", code: 0 });
      expect(new Set(f.starts().map(start => start.instance)).size).toBe(3);
      expect(readFileSync(join(f.root, "builds.txt"), "utf8").trim().split("\n")).toEqual([f.root, f.root]);
      const log = readFileSync(join(f.desktop, "desktop.log"), "utf8");
      expect(log).toContain("Pairing code: [hidden]");
      expect(log).not.toContain("TEST-PAIRING-SECRET");
    } finally { await f.dispose(); }
  }, 110_000);

  it.each([
    { content: '<link href="/assets/pm-icon.svg">', state: "manual", open: true },
    { content: "unrelated", state: "occupied", open: false },
  ])("preserves the $state listener", async ({ content, state, open }) => {
    const server = createServer((_req, res) => res.end(content));
    const port = await listen(server);
    const f = fixture(port);
    try {
      expect(await f.command("open")).toMatchObject({ state, ok: open });
      expect(await f.command("restart")).toMatchObject({ state, code: 1 });
      expect(await f.command("rebuild")).toMatchObject({ state, code: 1 });
      expect(server.listening).toBe(true);
      expect(existsSync(join(f.root, "starts.jsonl"))).toBe(false);
      expect(existsSync(join(f.root, "builds.txt"))).toBe(false);
    } finally {
      await close(server);
      await f.dispose();
    }
  }, 20_000);
});
