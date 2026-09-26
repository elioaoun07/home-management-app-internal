// The Delivery runtime runs inside the PM server. A blocking child process there
// froze the server, every health probe timed out and the Command Center showed
// Offline during a live run (2026-09-26).
import { describe, expect, it } from "vitest";
import { runProcess } from "../../scripts/delivery-v2/process.mjs";
import { createDockerCli } from "../../scripts/delivery-v2/worker-boundary.mjs";

const node = process.execPath;

describe("runProcess", () => {
  it("keeps the event loop answering while a child runs", async () => {
    let ticks = 0;
    const timer = setInterval(() => (ticks += 1), 20);
    try {
      const result = await runProcess(node, ["-e", "setTimeout(() => {}, 600)"]);
      expect(result.status).toBe(0);
    } finally {
      clearInterval(timer);
    }
    expect(ticks).toBeGreaterThanOrEqual(5);
  });

  it("returns spawnSync's shape: status, both streams and piped input", async () => {
    const echo = "let s = ''; process.stdin.on('data', (c) => (s += c)); process.stdin.on('end', () => { process.stdout.write(s); process.stderr.write('err'); process.exitCode = 3; })";
    const result = await runProcess(node, ["-e", echo], { input: "hello" });
    expect(result).toMatchObject({ status: 3, stdout: "hello", stderr: "err", error: null });
  });

  it("kills a child that outlives its timeout and reports ETIMEDOUT with no status", async () => {
    const result = await runProcess(node, ["-e", "setTimeout(() => {}, 30000)"], { timeout: 200 });
    expect(result.status).toBeNull();
    expect(result.error?.code).toBe("ETIMEDOUT");
  });

  it("stops a child whose output overflows the buffer", async () => {
    const result = await runProcess(node, ["-e", "process.stdout.write('x'.repeat(4096))"], { maxBuffer: 1024 });
    expect(result.error?.code).toBe("ENOBUFS");
  });

  it("reports a missing program as a spawn error instead of waiting forever", async () => {
    const result = await runProcess("era-no-such-program-" + process.pid, []);
    expect(result.status).toBeNull();
    expect(result.error?.code).toBe("ENOENT");
  });
});

describe("docker CLI", () => {
  it("runs without blocking and keeps a blocking variant for the setup scripts", async () => {
    const docker = createDockerCli({ bin: node });
    const pending = docker.run(["-e", "process.stdout.write('ok')"]);
    expect(pending).toBeInstanceOf(Promise);
    expect(await pending).toEqual({ status: 0, stdout: "ok", stderr: "", error: null });
    expect(docker.runSync(["-e", "process.stdout.write('ok')"])).toEqual({ status: 0, stdout: "ok", stderr: "", error: null });
  });
});
